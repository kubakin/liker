import { Controller, Get, Post } from '@nestjs/common';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Post('start')
  async start() {
    return this.jobs.start();
  }

  @Post('stop')
  async stop() {
    return this.jobs.stop();
  }

  @Get('status')
  status() {
    return this.jobs.status();
  }
}
