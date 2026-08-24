#!/usr/bin/env bash

set -euo pipefail

if [[ "$#" -eq 0 ]]; then
  printf 'A command is required\n' >&2
  exit 64
fi

config_file="${ACTIVITY_CONFIG_FILE:-${HOME}/.config/personal-blog/activity.env}"

# Explicitly supplied environment values take precedence over the saved local
# config. The wizard-generated file is loaded only when no activity settings
# are already present.
if [[ -z "${ACTIVITY_REPOSITORIES:-}"
  && -z "${ACTIVITY_AUTHOR_LOGIN:-}"
  && -z "${ACTIVITY_DENYLIST:-}"
  && -z "${ACTIVITY_GITHUB_TOKEN:-}"
  && -z "${ACTIVITY_GITHUB_TOKEN_POLICY:-}"
  && -f "$config_file" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$config_file"
  set +a
fi

exec "$@"
