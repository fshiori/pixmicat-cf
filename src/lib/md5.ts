/**
 * MD5 Hash 計算工具
 * 使用 spark-md5 進行 MD5 計算，在測試和生產環境都能正常工作
 */

import SparkMD5 from 'spark-md5';

/**
 * 計算 MD5 hash
 * @param data - File、Uint8Array 或 ArrayBuffer
 * @returns MD5 hash 字串（小寫十六進制）
 */
export async function calculateMD5(data: File | Uint8Array | ArrayBuffer): Promise<string> {
  const spark = new SparkMD5.ArrayBuffer();

  if (data instanceof File) {
    // 從 File 計算
    const arrayBuffer = await data.arrayBuffer();
    spark.append(arrayBuffer);
  } else if (data instanceof Uint8Array) {
    // 從 Uint8Array 計算
    spark.append(data.buffer);
  } else {
    // 從 ArrayBuffer 計算
    spark.append(data);
  }

  return spark.end();
}

/**
 * 計算 MD5 hash（同步版本，僅用於 ArrayBuffer）
 * @param arrayBuffer - ArrayBuffer 數據
 * @returns MD5 hash 字串（小寫十六進制）
 */
export function calculateMD5Sync(arrayBuffer: ArrayBuffer): string {
  return SparkMD5.ArrayBuffer.hash(arrayBuffer);
}
