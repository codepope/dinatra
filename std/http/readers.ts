// Copyright 2018-2019 the Deno authors. All rights reserved. MIT license.

import { BufReader } from 'https://deno.land/std@v0.3.2/io/bufio.ts';
import { TextProtoReader } from 'https://deno.land/std@v0.3.2/textproto/mod.ts';
import { assert } from 'https://deno.land/std@v0.3.2/testing/asserts.ts';

export class BodyReader implements Deno.Reader {
  total: number;
  bufReader: BufReader;

  constructor(reader: Deno.Reader, private contentLength: number) {
    this.total = 0;
    this.bufReader = new BufReader(reader);
  }

  async read(p: Uint8Array): Promise<Deno.ReadResult> {
    if (p.length > this.contentLength - this.total) {
      const buf = new Uint8Array(this.contentLength - this.total);
      const [nread, err] = await this.bufReader.readFull(buf);
      if (err && err !== 'EOF') {
        throw err;
      }
      p.set(buf);
      this.total += nread;
      assert(
        this.total === this.contentLength,
        `${this.total}, ${this.contentLength}`
      );
      return { nread, eof: true };
    } else {
      const { nread } = await this.bufReader.read(p);
      this.total += nread;
      return { nread, eof: false };
    }
  }
}

export class ChunkedBodyReader implements Deno.Reader {
  bufReader = new BufReader(this.reader);
  tpReader = new TextProtoReader(this.bufReader);

  constructor(private reader: Deno.Reader) {}

  chunks: Uint8Array[] = [];
  crlfBuf = new Uint8Array(2);
  finished: boolean = false;

  async read(p: Uint8Array): Promise<Deno.ReadResult> {
    const [line, sizeErr] = await this.tpReader.readLine();
    if (sizeErr) {
      throw sizeErr;
    }
    const len = parseInt(line, 16);
    if (len === 0) {
      this.finished = true;
      await this.bufReader.readFull(this.crlfBuf);
      return { nread: 0, eof: true };
    } else {
      const buf = new Uint8Array(len);
      await this.bufReader.readFull(buf);
      await this.bufReader.readFull(this.crlfBuf);
      this.chunks.push(buf);
    }
    const buf = this.chunks[0];
    if (buf) {
      if (buf.byteLength <= p.byteLength) {
        p.set(buf);
        this.chunks.shift();
        return { nread: buf.byteLength, eof: false };
      } else {
        p.set(buf.slice(0, p.byteLength));
        this.chunks[0] = buf.slice(p.byteLength, buf.byteLength);
        return { nread: p.byteLength, eof: false };
      }
    } else {
      return { nread: 0, eof: true };
    }
  }
}
