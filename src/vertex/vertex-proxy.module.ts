import { Module } from '@nestjs/common';
import { VertexProxyService } from './vertex-proxy.service';
import { VertexProxyController } from './vertex-proxy.controller';

@Module({
  providers: [VertexProxyService],
  controllers: [VertexProxyController],
})
export class VertexProxyModule {}
