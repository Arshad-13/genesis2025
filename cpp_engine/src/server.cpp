#include <iostream>
#include <memory>
#include <string>

#include <grpcpp/grpcpp.h>
#include "analytics.grpc.pb.h"
#include "analytics_engine.h"

using grpc::Server;
using grpc::ServerBuilder;
using grpc::ServerContext;
using grpc::Status;

using analytics::AnalyticsService;
using analytics::Snapshot;
using analytics::ProcessedSnapshot;

class AnalyticsServiceImpl final : public AnalyticsService::Service {
private:
    AnalyticsEngine engine;

public:
    Status ProcessSnapshot(ServerContext* context,
                           const Snapshot* request,
                           ProcessedSnapshot* response) override {

        // Debug output
        std::cout << "=== C++ Engine Processing ===" << std::endl;
        std::cout << "Bids: " << request->bids_size() << ", Asks: " << request->asks_size() << std::endl;
        
        if (request->bids_size() > 0 && request->asks_size() > 0) {
            std::cout << "L1: Bid=" << request->bids(0).price() << "@" << request->bids(0).volume() 
                      << ", Ask=" << request->asks(0).price() << "@" << request->asks(0).volume() << std::endl;
        }

        // Use real analytics engine
        *response = engine.processSnapshot(*request);
        std::cout << *response << std::endl;
        
        std::cout << "Results: Spread=" << response->spread() 
                  << ", OFI=" << response->ofi() 
                  << ", OBI=" << response->obi() 
                  << ", Microprice=" << response->microprice() << std::endl;
        std::cout << "=========================" << std::endl;
        
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
