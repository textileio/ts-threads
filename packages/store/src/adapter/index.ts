import { RWLock } from 'async-rwlock'
import { Service } from '@textile/threads-service'
import { ThreadID, LogID } from '@textile/threads-core'
import { Event, Entity } from '../'

// eslint-disable-next-line import/no-cycle
import { Store } from '../store'

// SingleThreadAdapter connects a Store with a Threadservice
export class Adapter<E extends Event, T extends Entity> {
  private api: Service
  private logID: LogID = ''
  private lock: RWLock = new RWLock()
  private started = false
  private closed = false
  constructor(private store: Store<E, T>, private threadID: ThreadID) {
    this.api = store.service
  }
  // Close closes the storehead and stops listening both directions of thread<->store
  async close(): Promise<void> {
    return
  }
  // Start starts connection from Store to Threadservice, and viceversa
  async start(): Promise<void> {
    return
  }
}
