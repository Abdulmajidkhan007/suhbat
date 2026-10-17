# coturn (TURN) — suhbat qo'ng'iroqlari uchun. Build context — REPO ILDIZI:
#   docker build -f infra/turn/Dockerfile -t suhbat-turn .
# Sozlash env orqali (infra/turn/entrypoint.sh boshida ro'yxat), README.md ga qarang.
FROM coturn/coturn:4.9.0-alpine
COPY --chmod=755 infra/turn/entrypoint.sh /usr/local/bin/suhbat-turn
EXPOSE 3478/tcp 3478/udp 5349/tcp
ENTRYPOINT ["suhbat-turn"]
