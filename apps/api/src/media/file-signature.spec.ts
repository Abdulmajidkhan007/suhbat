import { describe, expect, it } from 'vitest';
import { sniffFamily, validateUploadContent } from './file-signature';

const bytes = (...b: number[]) => Buffer.from(b);
const pad = (b: Buffer, n = 16) => Buffer.concat([b, Buffer.alloc(n)]);
const ftyp = (brand: string) => Buffer.concat([bytes(0, 0, 0, 0x18), Buffer.from('ftyp'), Buffer.from(brand), bytes(0, 0, 0, 0)]);
const riff = (form: string) => Buffer.concat([Buffer.from('RIFF'), bytes(0, 0, 0, 0), Buffer.from(form), bytes(0, 0, 0, 0)]);

const JPEG = pad(bytes(0xff, 0xd8, 0xff, 0xe0));
const PNG = pad(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a));
const GIF = pad(Buffer.from('GIF89a'));
const PDF = Buffer.from('%PDF-1.7\n%âãÏÓ');
const ZIP = pad(bytes(0x50, 0x4b, 0x03, 0x04));

describe('sniffFamily', () => {
  it('imzolar bo\'yicha aniqlaydi', () => {
    expect(sniffFamily(JPEG)).toBe('jpeg');
    expect(sniffFamily(PNG)).toBe('png');
    expect(sniffFamily(GIF)).toBe('gif');
    expect(sniffFamily(riff('WEBP'))).toBe('webp');
    expect(sniffFamily(riff('WAVE'))).toBe('wav');
    expect(sniffFamily(riff('AVI '))).toBeNull();
    expect(sniffFamily(PDF)).toBe('pdf');
    expect(sniffFamily(ZIP)).toBe('zip');
    expect(sniffFamily(pad(bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)))).toBe('ole');
    expect(sniffFamily(pad(Buffer.from('OggS')))).toBe('ogg');
    expect(sniffFamily(pad(bytes(0x1a, 0x45, 0xdf, 0xa3)))).toBe('webm');
    expect(sniffFamily(ftyp('M4A '))).toBe('mp4');
    expect(sniffFamily(ftyp('qt  '))).toBe('qt');
    expect(sniffFamily(pad(Buffer.from('ID3')))).toBe('mp3');
    expect(sniffFamily(pad(bytes(0xff, 0xfb, 0x90)))).toBe('mp3');
    expect(sniffFamily(pad(bytes(0xff, 0xf1, 0x50)))).toBe('aac');
  });

  it('matn va JSON; markup, shebang, ikkilik — null', () => {
    expect(sniffFamily(Buffer.from('salom dunyo\nikkinchi qator'))).toBe('text');
    expect(sniffFamily(Buffer.from('﻿a,b,c\n1,2,3'))).toBe('text');
    expect(sniffFamily(Buffer.from(' \n{"a": 1}'))).toBe('json');
    expect(sniffFamily(Buffer.from('<html><body>'))).toBeNull();
    expect(sniffFamily(Buffer.from('  \n<?xml version="1.0"?><svg/>'))).toBeNull();
    expect(sniffFamily(Buffer.from('#!/bin/sh\nid'))).toBeNull();
    expect(sniffFamily(bytes(0x4d, 0x5a, 0x90, 0x00, 0x03))).toBeNull(); // Windows .exe (NUL bayt)
    expect(sniffFamily(Buffer.alloc(0))).toBe('text');
  });
});

describe('validateUploadContent', () => {
  it('mos kelganda null', () => {
    expect(validateUploadContent('image/jpeg', 'IMG_1.JPG', JPEG)).toBeNull();
    expect(validateUploadContent('image/png', 'rasm.png', PNG)).toBeNull();
    expect(validateUploadContent('image/gif', 'a.gif', GIF)).toBeNull();
    expect(validateUploadContent('application/pdf', 'hujjat.pdf', PDF)).toBeNull();
    expect(validateUploadContent('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'a.docx', ZIP)).toBeNull();
    expect(validateUploadContent('audio/mp4', 'voice.m4a', ftyp('M4A '))).toBeNull();
    expect(validateUploadContent('audio/webm', 'voice.webm', pad(bytes(0x1a, 0x45, 0xdf, 0xa3)))).toBeNull();
    expect(validateUploadContent('video/quicktime', 'v.mov', ftyp('qt  '))).toBeNull();
    expect(validateUploadContent('text/plain', 'yozuv.md', Buffer.from('# sarlavha'))).toBeNull();
    expect(validateUploadContent('application/json', 'a.json', Buffer.from('{"x":1}'))).toBeNull();
    expect(validateUploadContent('image/png', 'kengaytmasiz', PNG)).toBeNull();
  });

  it('HTML/SVG/skript rasm sifatida o\'tmaydi (Content-Type va nom rasm bo\'lsa ham)', () => {
    const html = Buffer.from('<!DOCTYPE html><script>alert(1)</script>');
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');
    expect(validateUploadContent('image/png', 'rasm.png', html)).toMatch(/mos emas/);
    expect(validateUploadContent('image/jpeg', 'rasm.jpg', svg)).toMatch(/mos emas/);
    expect(validateUploadContent('image/png', 'rasm.png', Buffer.from('alert(1)'))).toMatch(/mos emas/);
    expect(validateUploadContent('text/plain', 'a.txt', html)).toMatch(/mos emas/);
  });

  it('e\'lon qilingan tur boshqa, ichi boshqa — rad', () => {
    expect(validateUploadContent('image/png', 'a.png', JPEG)).toMatch(/mos emas/);
    expect(validateUploadContent('application/pdf', 'a.pdf', ZIP)).toMatch(/mos emas/);
    expect(validateUploadContent('audio/mpeg', 'a.mp3', PNG)).toMatch(/mos emas/);
  });

  it('nomi mazmuniga mos kelmasa — rad (rasm.jpg deb nomlangan PDF/dastur)', () => {
    expect(validateUploadContent('application/pdf', 'rasm.jpg', PDF)).toMatch(/kengaytma/);
    expect(validateUploadContent('application/zip', 'rasm.png', ZIP)).toMatch(/kengaytma/);
    expect(validateUploadContent('image/png', 'rasm.jpg', PNG)).toMatch(/kengaytma/);
    expect(validateUploadContent('application/zip', 'tarix.bin', ZIP)).toMatch(/kengaytma/);
  });

  it('xavfli kengaytma hech qachon o\'tmaydi', () => {
    for (const name of ['x.html', 'x.SVG', 'x.js', 'x.exe', 'x.sh', 'x.xml', 'x.htm']) {
      expect(validateUploadContent('text/plain', name, Buffer.from('salom'))).toMatch(/ruxsat etilmagan/);
    }
  });

  it('ruxsat etilmagan e\'lon qilingan tur — rad', () => {
    expect(validateUploadContent('text/html', 'a.txt', Buffer.from('salom'))).toMatch(/ruxsat etilmagan/);
    expect(validateUploadContent('image/svg+xml', 'a.svg', Buffer.from('<svg/>'))).toMatch(/ruxsat etilmagan/);
  });

  it('mime parametrlari va katta-kichik harf e\'tiborga olinmaydi', () => {
    expect(validateUploadContent('Text/Plain; charset=utf-8', 'a.txt', Buffer.from('salom'))).toBeNull();
  });
});
