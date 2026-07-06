FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY proto ./proto
COPY rpc_stubs ./rpc_stubs

RUN python -m grpc_tools.protoc \
    -I proto \
    --python_out=rpc_stubs \
    --grpc_python_out=rpc_stubs \
    proto/live.proto && \
    sed -i 's/^import live_pb2/from . import live_pb2/' rpc_stubs/live_pb2_grpc.py && \
    if [ ! -f rpc_stubs/__init__.py ]; then touch rpc_stubs/__init__.py; fi

COPY binance_depth.py .
COPY main.py .

EXPOSE 6000

CMD ["python", "main.py"]
