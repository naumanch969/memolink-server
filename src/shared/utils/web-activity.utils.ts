export const decodeDomain = (encodedDomain: string): string => {
    if (!encodedDomain) return encodedDomain;
    // Order matters: 
    // 1. Handle our specific token
    // 2. Handle corrupted tokens from previous bugs (..dot..)
    // 3. Handle legacy underscore encoding
    return encodedDomain
        .replace(/__dot__/g, '.')
        .replace(/\.\.dot\.\./g, '.')
        .replace(/_/g, '.');
};
