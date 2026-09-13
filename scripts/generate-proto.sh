#!/usr/bin/env bash
# Generates TypeScript types + NestJS gRPC service/client interfaces from
# contracts/proto/*.proto into libs/shared/src/grpc/generated, using ts-proto.
# Both the Inventory service (gRPC server) and the Retail Sales service
# (gRPC client) import from the generated output so the contract can't drift
# between the two sides of the call.
#
# Requires `protoc` on PATH (https://grpc.io/docs/protoc-installation/).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROTO_DIR="${ROOT_DIR}/contracts/proto"
OUT_DIR="${ROOT_DIR}/libs/shared/src/grpc/generated"
TS_PROTO_PLUGIN="${ROOT_DIR}/node_modules/.bin/protoc-gen-ts_proto"

if ! command -v protoc &>/dev/null; then
  echo "error: protoc not found on PATH. Install it (e.g. 'apt install protobuf-compiler' or 'brew install protobuf') and re-run." >&2
  exit 1
fi

if [ ! -x "${TS_PROTO_PLUGIN}" ]; then
  echo "error: ts-proto not installed. Run 'pnpm install' at the repo root first." >&2
  exit 1
fi

mkdir -p "${OUT_DIR}"

protoc \
  --plugin="protoc-gen-ts_proto=${TS_PROTO_PLUGIN}" \
  --ts_proto_out="${OUT_DIR}" \
  --ts_proto_opt=nestJs=true,outputServices=grpc-js,addGrpcMetadata=true,esModuleInterop=true \
  -I "${PROTO_DIR}" \
  "${PROTO_DIR}"/*.proto

echo "Generated gRPC types into ${OUT_DIR}"
