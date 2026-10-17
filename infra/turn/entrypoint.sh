#!/bin/sh
# coturn konfiguratsiyasini env'dan yasaydi va ishga tushiradi.
#
#   TURN_SECRET   (majburiy) API'dagi TURN_SECRET bilan aynan bir xil — vaqtinchalik
#                 login/parol (coturn "TURN REST API", use-auth-secret).
#   TURN_MODE     railway | vps (standart: vps)
#     railway — Railway UDP bermaydi: faqat TCP (3478, Railway TCP Proxy orqali). Relay
#               faqat shu serverning o'z manziliga ruxsat — ya'ni IKKALA qurilma ham shu
#               TURN orqali ulanadi (relay ↔ relay). Railway ichki tarmog'iga (Postgres,
#               API) va internetga relay YO'Q.
#     vps     — ochiq IP'li server (docker compose, network_mode: host): UDP+TCP 3478,
#               TLS 5349 (sertifikat berilsa), relay internetga; xususiy tarmoqlar taqiqlangan.
#   TURN_REALM        standart: suhbat
#   TURN_PORT         standart: 3478
#   TURN_RELAY_IP     relay manzili; railway'da bo'lmasa — konteynerning birinchi IPv4 manzili,
#                     vps'da bo'lmasa — coturn o'zi tanlaydi
#   TURN_EXTERNAL_IP  vps: NAT ortida bo'lsa ochiq IP (masalan 1.2.3.4 yoki 1.2.3.4/10.0.0.5)
#   TURN_MIN_PORT / TURN_MAX_PORT  relay portlari (standart 49152–65535; railway 49152–49999)
#   TURN_TLS_CERT / TURN_TLS_KEY   vps: TLS (turns:, 5349) uchun fayl yo'llari
#   TURN_VERBOSE=1    batafsil log
set -eu

: "${TURN_SECRET:?TURN_SECRET kerak (API dagi bilan bir xil): openssl rand -hex 32}"
MODE="${TURN_MODE:-vps}"
REALM="${TURN_REALM:-suhbat}"
PORT="${TURN_PORT:-3478}"
CONF="${TURN_CONF:-/tmp/turnserver.conf}"

first_ipv4() {
  for ip in $(hostname -i 2>/dev/null) $(hostname -I 2>/dev/null); do
    case "$ip" in
      127.*|*:*) ;;
      *) echo "$ip"; return 0 ;;
    esac
  done
  return 1
}

RELAY_IP="${TURN_RELAY_IP:-}"
if [ "$MODE" = "railway" ] && [ -z "$RELAY_IP" ]; then RELAY_IP="$(first_ipv4 || true)"; fi

{
  echo "listening-port=$PORT"
  echo "realm=$REALM"
  echo "use-auth-secret"
  echo "static-auth-secret=$TURN_SECRET"
  echo "fingerprint"
  echo "no-cli"
  echo "no-multicast-peers"
  echo "no-rfc5780"
  echo "no-stun-backward-compatibility"
  echo "response-origin-only-with-rfc5780"
  echo "log-file=stdout"
  echo "simple-log"
  echo "user-quota=12"
  echo "total-quota=1200"
  echo "stale-nonce=600"
  [ "${TURN_VERBOSE:-}" = "1" ] && echo "verbose"

  case "$MODE" in
    railway)
      [ -n "$RELAY_IP" ] || { echo "relay IP topilmadi: TURN_RELAY_IP bering" >&2; exit 1; }
      echo "no-udp"
      echo "no-tls"
      echo "no-dtls"
      echo "relay-ip=$RELAY_IP"
      echo "min-port=${TURN_MIN_PORT:-49152}"
      echo "max-port=${TURN_MAX_PORT:-49999}"
      # Hamma manzil taqiqlangan, faqat o'zimizning relay manzil ochiq: relay ↔ relay.
      echo "denied-peer-ip=0.0.0.0-255.255.255.255"
      echo "denied-peer-ip=::-ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff"
      echo "allowed-peer-ip=$RELAY_IP"
      ;;
    vps)
      [ -n "$RELAY_IP" ] && echo "relay-ip=$RELAY_IP"
      [ -n "${TURN_EXTERNAL_IP:-}" ] && echo "external-ip=$TURN_EXTERNAL_IP"
      echo "min-port=${TURN_MIN_PORT:-49152}"
      echo "max-port=${TURN_MAX_PORT:-65535}"
      if [ -n "${TURN_TLS_CERT:-}" ] && [ -n "${TURN_TLS_KEY:-}" ]; then
        echo "tls-listening-port=${TURN_TLS_PORT:-5349}"
        echo "cert=$TURN_TLS_CERT"
        echo "pkey=$TURN_TLS_KEY"
        echo "no-tlsv1"
        echo "no-tlsv1_1"
      else
        echo "no-tls"
        echo "no-dtls"
      fi
      # Xususiy/xizmat tarmoqlariga relay yo'q (SSRF himoyasi).
      for r in 0.0.0.0-0.255.255.255 10.0.0.0-10.255.255.255 100.64.0.0-100.127.255.255 \
               127.0.0.0-127.255.255.255 169.254.0.0-169.254.255.255 172.16.0.0-172.31.255.255 \
               192.0.0.0-192.0.0.255 192.168.0.0-192.168.255.255 198.18.0.0-198.19.255.255 \
               240.0.0.0-255.255.255.255 ::1 64:ff9b::-64:ff9b::ffff:ffff \
               fc00::-fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff fe80::-febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff; do
        echo "denied-peer-ip=$r"
      done
      ;;
    *)
      echo "TURN_MODE noma'lum: $MODE (railway | vps)" >&2
      exit 1
      ;;
  esac
} > "$CONF"

echo "suhbat-turn: rejim=$MODE port=$PORT relay-ip=${RELAY_IP:-avto}" >&2
exec turnserver -c "$CONF" "$@"
