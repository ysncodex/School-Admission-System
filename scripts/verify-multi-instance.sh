#!/usr/bin/env bash
set -euo pipefail

PRIMARY_API="${PRIMARY_API:-http://localhost:8080}"
SECONDARY_API="${SECONDARY_API:-http://localhost:8081}"
CAPACITY="${CAPACITY:-8}"
REQUESTS="${REQUESTS:-80}"

for api in "$PRIMARY_API" "$SECONDARY_API"; do
  if ! curl --fail --silent "$api/health" >/dev/null; then
    echo "API is not healthy at $api. Start Compose with --profile multi-instance first." >&2
    exit 1
  fi
done

class_payload=$(printf '{"name":"Multi instance check %s","totalSeats":%d}' "$(date +%s)" "$CAPACITY")
created=$(curl --fail --silent -X POST "$PRIMARY_API/classes" -H 'Content-Type: application/json' -d "$class_payload")
class_id=$(printf '%s' "$created" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
if [[ -z "$class_id" ]]; then
  echo "Could not read class ID from API response: $created" >&2
  exit 1
fi

echo "Created $class_id with $CAPACITY seats. Sending $REQUESTS requests across both API processes..."
export class_id PRIMARY_API SECONDARY_API
mapfile -t statuses < <(
  seq 1 "$REQUESTS" | xargs -P "$REQUESTS" -I '{}' bash -c '
    i="$1"
    if (( i % 2 == 0 )); then api="$SECONDARY_API"; else api="$PRIMARY_API"; fi
    student_id=$(printf "%017d" "$((10000000000000000 + i))")
    curl --silent --output /dev/null --write-out "%{http_code}\n" \
      -X POST "$api/classes/$class_id/holds" -H "X-Student-Id: $student_id"
  ' _ '{}'
)

created_count=$(printf '%s\n' "${statuses[@]}" | grep -c '^201$' || true)
conflict_count=$(printf '%s\n' "${statuses[@]}" | grep -c '^409$' || true)
summary=$(curl --fail --silent "$PRIMARY_API/classes/$class_id")

printf '\nHTTP 201 reservations: %s\nHTTP 409 conflicts: %s\nClass summary: %s\n' \
  "$created_count" "$conflict_count" "$summary"

if [[ "$created_count" -ne "$CAPACITY" || "$conflict_count" -ne "$((REQUESTS - CAPACITY))" ]]; then
  echo "FAIL: expected exactly $CAPACITY successful reservations and $((REQUESTS - CAPACITY)) conflicts." >&2
  exit 1
fi

echo "PASS: the two API processes did not allocate more than the class capacity."
