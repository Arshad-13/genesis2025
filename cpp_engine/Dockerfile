FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    pkg-config \
    protobuf-compiler \
    libprotobuf-dev \
    grpc++ \
    libgrpc++-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY proto ./proto
COPY src ./src
COPY CMakeLists.txt .

RUN protoc -I proto \
    --cpp_out=src \
    --grpc_out=src \
    --plugin=protoc-gen-grpc=/usr/bin/grpc_cpp_plugin \
    proto/analytics.proto

RUN cmake -S . -B build && \
    cmake --build build

EXPOSE 50051

CMD ["./build/analytics_server"]
