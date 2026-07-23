export const U = {
  getFirstMatch(re: RegExp, s: string): string {
    const m = re.exec(s);
    return (m && m[1]) || '';
  },
  getSecondMatch(re: RegExp, s: string): string {
    const m = re.exec(s);
    return (m && m[2]) || '';
  },
  matchAndReturnConst<T>(re: RegExp, s: string, value: T): T | undefined {
    return re.test(s) && value;
  },
  toLower(s: string): string {
    return (s || '').toLowerCase();
  },
  joinVersionParts(parts: Array<string | undefined | null>): string {
    return parts.filter(Boolean).join('.');
  },
};
