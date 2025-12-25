cmake_minimum_required(VERSION 3.15)
project(cpp_analytics_engine)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

find_package(Protobuf REQUIRED)
find_package(PkgConfig REQUIRED)

pkg_check_modules(GRPC REQUIRED grpc++)

include_directories(
    ${Protobuf_INCLUDE_DIRS}
    ${GRPC_INCLUDE_DIRS}
)

add_executable(analytics_server
    src/server.cpp
    src/analytics_engine.cpp
    src/analytics.pb.cc
    src/analytics.grpc.pb.cc
)

target_link_libraries(analytics_server
    ${Protobuf_LIBRARIES}
    ${GRPC_LIBRARIES}
)

target_compile_options(analytics_server PRIVATE ${GRPC_CFLAGS_OTHER})
