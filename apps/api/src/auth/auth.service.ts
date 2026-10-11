import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthResponse, LoginInput, RegisterInput, User } from '@suhbat/core';
import * as argon2 from 'argon2';
import { Prisma } from '../generated/prisma/client';
import type { User as UserRow } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
}

export const toPublicUser = (u: UserRow): User => ({
  id:          u.id,
  email:       u.email,
  displayName: u.displayName,
  photoUrl:    u.photoUrl,
  createdAt:   u.createdAt.toISOString(),
});

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResponse> {
    const passwordHash = await argon2.hash(input.password);
    try {
      const user = await this.prisma.user.create({
        data: { email: input.email, passwordHash, displayName: input.displayName },
      });
      return this.issue(user);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Bu email bilan hisob mavjud');
      }
      throw e;
    }
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !(await argon2.verify(user.passwordHash, input.password))) {
      throw new UnauthorizedException('Email yoki parol noto\'g\'ri');
    }
    return this.issue(user);
  }

  async me(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return toPublicUser(user);
  }

  private async issue(user: UserRow): Promise<AuthResponse> {
    const payload: JwtPayload = { sub: user.id };
    return { accessToken: await this.jwt.signAsync(payload), user: toPublicUser(user) };
  }
}
