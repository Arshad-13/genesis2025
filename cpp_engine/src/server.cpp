#include <iostream>
#include <memory>
#include <string>

#include <grpcpp/grpcpp.h>
#include "analytics.grpc.pb.h"

using grpc::Server;
using grpc::ServerBuilder;
using grpc::ServerContext;
using grpc::Status;

using analytics::AnalyticsService;
using analytics::Snapshot;
using analytics::ProcessedSnapshot;

class AnalyticsServiceImpl final : public AnalyticsService::Service {
public:
    Status ProcessSnapshot(ServerContext* context,
                           const Snapshot* request,
                           ProcessedSnapshot* response) override {

        // Minimal echo logic (temporary)
        response->set_timestamp(request->timestamp());
        response->set_mid_price(request->mid_price());
        response->set_spread(0.0);
        response->set_ofi(0.0);
        response->set_obi(0.0);

        return Status::OK;
    }
};

void RunServer() {
    std::string server_address("0.0.0.0:50051");
    AnalyticsServiceImpl service;

    ServerBuilder builder;
    builder.AddListeningPort(server_address, grpc::InsecureServerCredentials());
    builder.RegisterService(&service);

    std::unique_ptr<Server> server(builder.BuildAndStart());
    std::cout << "C++ Analytics Engine listening on " << server_address << std::endl;

    server->Wait();
}

int main() {
    RunServer();
    return 0;
}
