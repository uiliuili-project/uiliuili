import { Injectable } from '@nestjs/common';
import type { DanmakuItem } from '@uiliuili/shared';
import { type Observable, Subject } from 'rxjs';

export interface DanmakuEvent {
  videoId: string;
  item: DanmakuItem;
}

@Injectable()
export class DanmakuBus {
  private readonly subject = new Subject<DanmakuEvent>();

  get events(): Observable<DanmakuEvent> {
    return this.subject.asObservable();
  }

  publish(event: DanmakuEvent): void {
    this.subject.next(event);
  }
}
