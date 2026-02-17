import { Global, Module } from '@nestjs/common';
import { VkService } from './vk.service';

@Global()
@Module({
  providers: [VkService],
  exports: [VkService],
})
export class VkModule {}
