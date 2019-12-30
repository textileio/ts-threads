/* eslint-disable @typescript-eslint/no-var-requires */
import { EventEmitter } from 'tsee'
import { Datastore, Key } from 'interface-datastore'
import { NamespaceDatastore } from 'datastore-core'
import { TTLDatastore, Duration, TTLDatastoreOptions } from '@textile/datastore-ttl'
import { Multiaddr, ID } from '@textile/threads-core'
import { Closer, LogsThreads } from '.'

// @todo: Find or create types for this package
const multiaddr = require('multiaddr')

// Thread addresses are stored db key pattern:
// /thread/addrs/<b32 thread id no padding>/<b32 log id no padding>/<multiaddr string>
const baseKey = new Key('/thread/addrs')
const getKey = (id: ID, log: string) => new Key(id.string()).child(new Key(log))

// Events are for the book's EventEmitter
type Events = {
  newAddr: (log: string, addrs: Multiaddr[]) => void
}

export class AddrBook extends EventEmitter<Events> implements LogsThreads, Closer {
  private datastore: TTLDatastore<Buffer>
  constructor(datastore: Datastore<Buffer>, opts?: TTLDatastoreOptions) {
    super() // EventEmitter
    const options = { ttl: opts?.ttl || Duration.Hour, frequency: opts?.frequency || Duration.Hour * 2 }
    // const store = new NamespaceDatastore(datastore, baseKey)
    this.datastore = new TTLDatastore(datastore, new NamespaceDatastore(datastore, new Key('ttl')), {
      frequency: 20,
      ttl: 100,
    })
  }
  // put adds to a log's address(es) with the given TTL. TTLs for existing addrs will be updated.
  // If no addrs are provided, it simply updates the TTL values of all existing addrs.
  async put(id: ID, log: string, ttl: number, ...addrs: Multiaddr[]) {
    const baseKey = getKey(id, log)
    const batch = this.datastore.batch(ttl)
    if (addrs.length === 0) {
      // Update the TTL values of all existing addrs
      for await (const { key, value } of this.datastore.query({ prefix: baseKey.toString() })) {
        if (ttl <= 0) batch.delete(key)
        else batch.put(key, value)
      }
      return batch.commit()
    }
    for (const addr of addrs) {
      const key = baseKey.child(new Key(addr.toString()))
      if (ttl <= 0) {
        batch.delete(key)
        continue
      }
      const has = await this.datastore.has(key)
      if (has) {
        const exp = await this.datastore.expiration(key)
        if (exp < Date.now() + ttl) {
          // We never want to reduce ttl, just update
          batch.put(key, addr.buffer)
        }
      } else {
        batch.put(key, addr.buffer)
        this.emit('newAddr', log, addrs)
      }
    }
    return await batch.commit()
  }
  // get returns all addresses for a given log.
  async get(id: ID, log: string) {
    const addrs: Multiaddr[] = []
    const it = this.datastore.query({ prefix: getKey(id, log).toString() })
    for await (const { key, value } of it) {
      console.log(key.toString())
      addrs.push(multiaddr(value))
    }
    return addrs
  }
  // threads returns a list of threads referenced in the book.
  async threads() {
    const threads = new Set<ID>()
    for await (const { key } of this.datastore.query({ keysOnly: true })) {
      threads.add(
        ID.fromEncoded(
          key
            .reverse()
            .baseNamespace()
            .toString(),
        ),
      )
    }
    return threads
  }
  async logs(id: ID) {
    const logs = new Set<string>()
    for await (const { key } of this.datastore.query({ keysOnly: true })) {
      logs.add(
        key
          .reverse()
          .parent()
          .baseNamespace()
          .toString(),
      )
    }
    return logs
  }
  // clear deletes all addresses for a log.
  async clear(id: ID, log: string) {
    const batch = this.datastore.batch()
    const it = this.datastore.query({ keysOnly: true, prefix: getKey(id, log).toString() })
    for await (const { key } of it) {
      batch.delete(key)
    }
    return await batch.commit()
  }
  async close() {
    return this.datastore.close()
  }
}