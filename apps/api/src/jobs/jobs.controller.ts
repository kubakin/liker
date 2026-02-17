import { Controller, Get, Post, Query } from '@nestjs/common';
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

  @Get('estimate')
  estimate() {
    return this.jobs.estimate();
  }

  @Get('processed')
  getProcessed(@Query('date') date?: string) {
    const d =
      date && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? date
        : new Date().toISOString().slice(0, 10);
    return this.jobs.getProcessedByDate(d);
  }
}
