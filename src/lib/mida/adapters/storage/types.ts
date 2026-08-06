export interface StorageAdapter {
  /**
   * Store an object under the suggested key and return the canonical key to
   * persist. Most adapters return the key unchanged; the Vercel Blob adapter
   * returns the object's public URL.
   */
  put(key: string, data: Buffer, contentType: string): Promise<string>;
  get(key: string): Promise<{ data: Buffer; contentType: string } | null>;
  /** Remove an object. Missing keys are not an error. */
  delete(key: string): Promise<void>;
  /** Public URL the browser can load the object from. */
  url(key: string): string;
}
