import { describe, expect, it } from 'vitest';
import apiClient from '../config/apiClient';
import { encodeFormData, prepareOutgoingBody } from './requestEnvelope';

const ST_LOUIS = {
  description: 'Heights 28.25"; and 40.25"; for St. Louis table bases.',
  overview_text: 'Heights 28.25"; and 40.25"; for St. Louis table bases.',
};

function decodeEnvelope(envelope) {
  const bytes = new Uint8Array(envelope.body.match(/../g).map((pair) => parseInt(pair, 16)));
  return JSON.parse(new TextDecoder().decode(bytes));
}

describe('request envelope', () => {
  it('keeps the quote-semicolon off the wire and restores both catalog fields', () => {
    const envelope = prepareOutgoingBody('put', ST_LOUIS);
    const wire = JSON.stringify(envelope);
    expect(wire).not.toContain('";');
    expect(envelope.body).toMatch(/^[0-9a-f]+$/);
    expect(decodeEnvelope(envelope)).toEqual(ST_LOUIS);
  });

  it('leaves reads and already packed bodies alone', () => {
    expect(prepareOutgoingBody('get', ST_LOUIS)).toBe(ST_LOUIS);
    const packed = prepareOutgoingBody('post', ST_LOUIS);
    expect(prepareOutgoingBody('post', packed)).toBe(packed);
  });

  it('packs form text fields and leaves file parts as files', () => {
    const form = new FormData();
    form.append('description', ST_LOUIS.description);
    form.append('file', new Blob(['pdf']), 'catalog.pdf');
    const packed = encodeFormData(form);
    const description = packed.get('description');
    expect(description.startsWith('echex1:')).toBe(true);
    expect(description).not.toContain('";');
    expect(packed.get('file')).toBeInstanceOf(Blob);
    expect(encodeFormData(packed)).toBe(packed);
  });
});

describe('api client writes', () => {
  it('sends the packed family save and does not send the raw inch marks', async () => {
    let sent;
    const adapter = async (config) => {
      sent = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
      return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
    };

    await apiClient.put('/api/v1/admin/catalog/families/4', ST_LOUIS, { adapter });

    expect(JSON.stringify(sent)).not.toContain('";');
    expect(decodeEnvelope(sent)).toEqual(ST_LOUIS);
  });
});
