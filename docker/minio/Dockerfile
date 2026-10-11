# MinIO endi Docker Hub/quay'da rasm ham, dl.min.io'da binary ham nashr qilmaydi (410).
# Manba kodi Go proxy'da bor — pin qilingan versiyani o'zimiz quramiz (birinchi qurish
# bir necha daqiqa oladi). Faqat lokal ishlab chiqish va CI uchun.
FROM golang:1.24-alpine AS build
ARG MINIO_VERSION=v0.0.0-20260212201848-7aac2a2c5b7c
RUN GOTOOLCHAIN=auto CGO_ENABLED=0 GOBIN=/out go install -trimpath -ldflags "-s -w" github.com/minio/minio@${MINIO_VERSION}

FROM alpine:3.21
RUN apk add --no-cache curl ca-certificates
COPY --from=build /out/minio /usr/local/bin/minio
EXPOSE 9000 9001
CMD ["minio", "server", "/data", "--console-address", ":9001"]
