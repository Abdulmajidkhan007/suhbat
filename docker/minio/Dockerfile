# MinIO endi Docker Hub/quay'da rasm nashr qilmaydi — rasmiy binary'ni o'zimiz o'rnatamiz.
# Faqat lokal ishlab chiqish va CI uchun (versiya pin qilinmagan: dl.min.io dagi oxirgisi).
FROM alpine:3.21
ARG TARGETARCH
RUN apk add --no-cache curl ca-certificates \
 && curl -fsSL "https://dl.min.io/server/minio/release/linux-${TARGETARCH:-amd64}/minio" -o /usr/local/bin/minio \
 && chmod +x /usr/local/bin/minio
EXPOSE 9000 9001
CMD ["minio", "server", "/data", "--console-address", ":9001"]
