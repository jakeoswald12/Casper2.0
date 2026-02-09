declare module 'epub-parser' {
  interface EpubParser {
    open(source: Buffer | string, callback: (err: Error | null, data: any) => void): void;
    extractText(filename: string): string;
    extractBinary(filename: string): string;
    getZip(): any;
  }
  const parser: EpubParser;
  export = parser;
}
