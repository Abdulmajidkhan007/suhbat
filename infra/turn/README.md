# TURN server (coturn) — o'zimizniki

Qo'ng'iroqda ikki qurilma to'g'ridan-to'g'ri ulana olmasa (mobil operator NAT'i, ofis tarmog'i),
ovoz/video TURN server orqali uzatiladi. Bu papka — [coturn](https://github.com/coturn/coturn)
image'i (`coturn/coturn:4.9.0-alpine`) va env'dan konfiguratsiya yasaydigan `entrypoint.sh`.

Login/parol doimiy emas: API har foydalanuvchiga vaqtinchalik credential beradi
(`TURN_SECRET`, coturn `use-auth-secret`). **Secret API'da va TURN'da aynan bir xil bo'lishi kerak.**

## Ikki rejim

| | `TURN_MODE=railway` | `TURN_MODE=vps` (tavsiya) |
|---|---|---|
| Qayerda | Railway (alohida xizmat) | Ochiq IP'li har qanday VPS (docker compose) |
| Transport | faqat **TCP** (Railway UDP bermaydi; TCP Proxy) | UDP + TCP (+ TLS 5349, sertifikat bo'lsa) |
| Relay | faqat o'z manziliga: **ikkala qurilma ham** shu TURN orqali | internetdagi istalgan manzilga (xususiy tarmoqlar taqiqlangan) |
| Sifat | TCP ustida ovoz/video: yo'qolgan paket qayta yuboriladi → kechikish ortadi | odatiy |
| Narx | Railway chiqish trafigi hisobidan | VPS narxi (odatda trafik kiritilgan) |

### Railway rejimi qanday ishlaydi
Railway kiruvchi UDP'ni qabul qilmaydi, lekin **TCP Proxy** bor (`xxx.proxy.rlwy.net:<port>` → konteynerning 3478).
Brauzer va telefon TURN'ga TCP orqali ulanadi (`turn:...?transport=tcp`). coturn har mijozga relay manzil
ajratadi (konteynerning ichki IP'si). Ikkala tomon ham shu TURN orqali ulanganda, coturn paketni bir relay'dan
ikkinchisiga konteyner ichida uzatadi — tashqi UDP kerak bo'lmaydi.

Xavfsizlik: relay faqat shu konteynerning o'z IP'siga ruxsat etilgan (`denied-peer-ip` hammasi,
`allowed-peer-ip=<relay IP>`), ya'ni TURN orqali Railway ichki tarmog'iga (Postgres, API) yoki internetga
chiqib bo'lmaydi.

**Holat:** mexanizm coturn bilan **lokal va CI'da sinalgan** (`turnutils_uclient`: TCP orqali ikki mijoz
relay ↔ relay xabar almashadi; begona manzil — 403; API formatidagi credential qabul qilinadi).
**Railway'ning o'zida sinalmagan** (akkaunt yo'q). Ochiq savollar: Railway konteynerida IPv4 manzil
borligi (bo'lmasa xizmat `relay IP topilmadi` deb to'xtaydi — `TURN_RELAY_IP` bering), TCP Proxy uzoq
ulanishlarni uzmasligi, haqiqiy qo'ng'iroqda TCP ustidagi kechikish qabul qilinarli ekani.

### Railway'da ishga tushirish
1. Loyihada **+ New → GitHub Repo →** `suhbat` (yangi xizmat, nomi masalan `turn`).
2. **Settings:** Root Directory — bo'sh; **Config file path** = `/infra/turn/railway.toml`.
3. **Variables:** `TURN_MODE=railway`, `TURN_SECRET=<openssl rand -hex 32>`.
4. **Settings → Networking → TCP Proxy** → port `3478` → Railway `xxx.proxy.rlwy.net:NNNNN` beradi.
5. API xizmati **Variables:**
   - `TURN_URLS=turn:xxx.proxy.rlwy.net:NNNNN?transport=tcp`
   - `TURN_SECRET=${{turn.TURN_SECRET}}` (reference — turn xizmatidagi bilan bir xil)

### VPS'da ishga tushirish (bitta buyruq)
Docker o'rnatilgan, ochiq IP'li server (1 vCPU / 1 GB yetadi):
```bash
git clone https://github.com/Abdulmajidkhan007/suhbat && cd suhbat/infra/turn
cp .env.example .env && sed -i "s/^TURN_SECRET=.*/TURN_SECRET=$(openssl rand -hex 32)/" .env
docker compose up -d --build
```
Firewall: `3478/udp`, `3478/tcp`, `49152-65535/udp` (TLS bo'lsa `5349/tcp`).
API Variables (`turn.suhbat.uz` — VPS IP'siga yo'naltirilgan domen yoki IP'ning o'zi):
```
TURN_URLS=turn:turn.suhbat.uz:3478?transport=udp,turn:turn.suhbat.uz:3478?transport=tcp
TURN_SECRET=<.env dagi qiymat>
STUN_URLS=stun:turn.suhbat.uz:3478
```
TLS (`turns:turn.suhbat.uz:5349`) — `.env` da `TURN_TLS_CERT/KEY` va `docker-compose.yml` da
`/etc/letsencrypt` volume. coturn `nobody` foydalanuvchisi bilan ishlaydi — kalit fayli unga o'qiladigan bo'lsin.

## STUN haqida
STUN (o'z ochiq manzilini bilish) faqat UDP'da ishlaydi. Railway rejimida STUN berib bo'lmaydi — API
standart `stun:stun.l.google.com:19302` ni beradi (akkaunt/kalit kerak emas, faqat manzil aniqlash; media
Google orqali o'tmaydi). Butunlay o'zimizda bo'lsin desangiz: `STUN_URLS=` (bo'sh) — shunda turli
tarmoqdagi qo'ng'iroqlar doim TURN orqali o'tadi (trafik ko'proq). VPS rejimida `STUN_URLS` — o'z serveringiz.

## Lokal sinov
```bash
docker build -f infra/turn/Dockerfile -t suhbat-turn .
docker run -d --name turn --network host -e TURN_MODE=railway -e TURN_SECRET=test suhbat-turn
docker logs turn                       # relay-ip=...
docker exec turn turnutils_uclient -t -y -n 20 -m 2 -W test -u u -p 3478 <relay-ip>
```
