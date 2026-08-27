#!/usr/bin/env bash

# Classify fixed AWS readbacks without turning authorization, throttling, network,
# or unknown failures into an "absent" result.
aws_absence_pattern() {
  case "$1" in
    cloudformation-stack) printf '%s' 'ValidationError.*does not exist' ;;
    ecr-repository) printf '%s' 'RepositoryNotFoundException' ;;
    sqs-queue) printf '%s' 'AWS\.SimpleQueueService\.NonExistentQueue|QueueDoesNotExist' ;;
    lambda-function|secret) printf '%s' 'ResourceNotFoundException' ;;
    apigateway-api) printf '%s' 'NotFoundException' ;;
    ssm-parameter) printf '%s' 'ParameterNotFound' ;;
    ecs-task-definition) printf '%s' 'ClientException.*(does not exist|Unable to describe task definition)' ;;
    *) return 2 ;;
  esac
}

# Returns 0 when present, 3 only for the service-specific absent error, and 1
# after retrying every other error. Successful JSON is written to the exact file.
aws_classify_to_file() {
  local output_file="$1"
  local resource_kind="$2"
  shift 2

  local retries="${AWS_CLASSIFY_RETRIES:-3}"
  local retry_delay="${AWS_CLASSIFY_RETRY_DELAY_SECONDS:-2}"
  local stdout_file stderr_file pattern attempt
  stdout_file="$(mktemp)"
  stderr_file="$(mktemp)"
  pattern="$(aws_absence_pattern "$resource_kind")" || {
    rm -f "$stdout_file" "$stderr_file"
    printf 'Unsupported AWS resource classification: %s\n' "$resource_kind" >&2
    return 1
  }

  attempt=1
  while test "$attempt" -le "$retries"; do
    if "$@" >"$stdout_file" 2>"$stderr_file"; then
      mv "$stdout_file" "$output_file"
      rm -f "$stderr_file"
      return 0
    fi
    if grep -Eiq "$pattern" "$stderr_file"; then
      : >"$output_file"
      rm -f "$stdout_file" "$stderr_file"
      return 3
    fi
    if test "$attempt" -lt "$retries"; then
      sleep "$retry_delay"
    fi
    attempt=$((attempt + 1))
  done

  cat "$stderr_file" >&2
  rm -f "$stdout_file" "$stderr_file"
  return 1
}

# Sign one immutable delivery and retry the same body, delivery id, timestamp,
# and signature for every attempt in this HTTP delivery.
performance_post_callback() {
  local callback_url="$1"
  local hmac_secret="$2"
  local body="$3"
  local delivery_id timestamp digest signature attempt

  delivery_id="$(printf '%s' "$body" | jq -er '.deliveryId')"
  timestamp="$(date -u +%s)"
  digest="$(printf '%s' "$timestamp.$body" | openssl dgst -sha256 -hmac "$hmac_secret" -binary | xxd -p -c 256)"
  signature="sha256=$digest"

  for attempt in 1 2 3; do
    if curl --fail-with-body --silent --show-error --output /dev/null \
      -X POST "$callback_url" \
      -H 'content-type: application/json' \
      -H "x-performance-timestamp: $timestamp" \
      -H "x-performance-delivery-id: $delivery_id" \
      -H "x-performance-signature-256: $signature" \
      --data-binary "$body"; then
      return 0
    fi
    if test "$attempt" -lt 3; then sleep 2; fi
  done
  return 1
}
