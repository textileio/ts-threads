import { grpc } from '@improbable-eng/grpc-web'
import {
  GetLogsRequest,
  GetLogsReply,
  Log as ProtoLog,
  PushLogRequest,
  GetRecordsReply,
  GetRecordsRequest,
} from '@textile/threads-service-grpc/service_pb'
import { Service } from '@textile/threads-service-grpc/service_pb_service'
import CID from 'cids'
import { ThreadID, LogID, LogInfo } from '@textile/threads-core'
import { Network } from '../interface'

/**
 * Client is a web-gRPC wrapper client for communicating with a webgRPC-enabled Textile server.
 * This client library can be used to interact with a local or remote Textile gRPC-service.
 */
export class Client implements Network {
  /**
   * Client creates a new gRPC client instance.
   * @param host The local/remote host url. Defaults to 'localhost:7006'.
   * @param defaultTransport The default transport to use when making webgRPC calls. Defaults to WebSockets.
   */
  constructor(private readonly host: string = 'localhost:7006', defaultTransport?: grpc.TransportFactory) {
    const transport = defaultTransport || grpc.WebsocketTransport()
    grpc.setDefaultTransport(transport)
  }
  // GetLogs from a peer.
  async getLogs(id: ThreadID, replicatorKey: Buffer) {
    const req = new GetLogsRequest()
    req.setFollowkey(replicatorKey)
    req.setThreadid(id.string())
    const header = new GetLogsRequest.Header()
    // @todo: Get this from the service layer?
    // header.setFrom(libp2pHostID)
    req.setHeader(header)
    const res = (await this.unary(Service.GetLogs, req)) as GetLogsReply.AsObject
    return res.logsList
  }
  // PushLog to a peer.
  async pushLog(id: ThreadID, log: LogInfo, replicatorKey: Buffer, readKey?: Buffer) {
    const req = new PushLogRequest()
    req.setFollowkey(replicatorKey)
    readKey && req.setReadkey(readKey)
    req.setThreadid(id.string())
    const header = new GetLogsRequest.Header()
    // @todo: Get this from the service layer?
    // header.setFrom(libp2pHostID)
    req.setHeader(header)
    const protoLog = new ProtoLog()
    protoLog.setAddrsList([...(log.addrs || [])].map(item => item.buffer))
    protoLog.setHeadsList([...(log.heads || [])].map(item => item.buffer))
    protoLog.setId(log.id)
    protoLog.setPubkey(log.pubKey.bytes)
    req.setLog(protoLog)
    await this.unary(Service.PushLog, req) // as PushLogReply.AsObject
    return
  }
  // // GetRecords from a peer.
  // async getRecords(id: ThreadID, logs: LogID[], replicatorKey: Buffer, opts: { offset: CID; limit: number }) {
  //   const req = new GetRecordsRequest()
  //   req.setFollowkey(replicatorKey)
  //   req.setThreadid(id)
  //   req.setLogsList(logs)
  // }
  // // PushRecord to a peer.
  // async pushRecord(id: ThreadID, log: LogID, record: any) {
  //   return
  // }
  private async unary<
    TRequest extends grpc.ProtobufMessage,
    TResponse extends grpc.ProtobufMessage,
    M extends grpc.UnaryMethodDefinition<TRequest, TResponse>
  >(methodDescriptor: M, req: TRequest) {
    return new Promise((resolve, reject) => {
      grpc.unary(methodDescriptor, {
        request: req,
        host: this.host,
        onEnd: res => {
          const { status, statusMessage, message } = res
          if (status === grpc.Code.OK) {
            if (message) {
              resolve(message.toObject())
            } else {
              resolve()
            }
          } else {
            reject(new Error(statusMessage))
          }
        },
      })
    })
  }
}
