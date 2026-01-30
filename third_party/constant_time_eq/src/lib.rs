// Vendored constant_time_eq 0.3.1 (edition 2021) for Cargo 1.84 compatibility.
// Original: https://github.com/cesarb/constant_time_eq (CC0-1.0 OR MIT-0 OR Apache-2.0)

/// Constant-time comparison of two equal-length byte slices.
#[inline]
pub fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

/// Constant-time comparison for 16-byte arrays.
#[inline]
pub fn constant_time_eq_16(a: &[u8; 16], b: &[u8; 16]) -> bool {
    constant_time_eq(a.as_slice(), b.as_slice())
}

/// Constant-time comparison for 32-byte arrays.
#[inline]
pub fn constant_time_eq_32(a: &[u8; 32], b: &[u8; 32]) -> bool {
    constant_time_eq(a.as_slice(), b.as_slice())
}

/// Constant-time comparison for 64-byte arrays.
#[inline]
pub fn constant_time_eq_64(a: &[u8; 64], b: &[u8; 64]) -> bool {
    constant_time_eq(a.as_slice(), b.as_slice())
}

/// Constant-time comparison for fixed-size arrays.
#[inline]
pub fn constant_time_eq_n<const N: usize>(a: &[u8; N], b: &[u8; N]) -> bool {
    constant_time_eq(a.as_slice(), b.as_slice())
}
