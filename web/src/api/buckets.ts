/**
 * Buckets API Client
 * 
 * Handles virtual envelope (bucket) operations for Hybrid Savings
 */

import axios from 'axios';

const API_BASE = '/api/buckets';

export interface Bucket {
  id: string;
  name: string;
  target_amount_cents: number | null;
  target_date: string | null;
  current_balance_cents: number;
  gamification_asset_id: string | null;
  is_hidden: number;
  created_at: string;
  updated_at: string;
}

export interface BucketMovement {
  id: string;
  bucket_id: string;
  date: string;
  amount_cents: number;
  memo: string | null;
  origin_type: 'INCOME' | 'TRANSFER_FROM_BUCKET' | 'MANUAL';
  origin_id: string | null;
  created_at: string;
}

export async function getBuckets(): Promise<Bucket[]> {
  const response = await axios.get<{ data: Bucket[] }>(API_BASE);
  return response.data.data;
}

export async function getBucket(id: string): Promise<Bucket> {
  const response = await axios.get<{ data: Bucket }>(`${API_BASE}/${id}`);
  return response.data.data;
}

export async function createBucket(data: {
  name: string;
  target_amount_cents?: number;
  target_date?: string;
  gamification_asset_id?: string;
}): Promise<Bucket> {
  const response = await axios.post<{ data: Bucket }>(API_BASE, data);
  return response.data.data;
}

export async function updateBucket(
  id: string,
  data: Partial<{
    name: string;
    target_amount_cents: number;
    target_date: string;
    gamification_asset_id: string;
    is_hidden: boolean;
  }>
): Promise<Bucket> {
  const response = await axios.patch<{ data: Bucket }>(`${API_BASE}/${id}`, data);
  return response.data.data;
}

export async function createBucketMovement(
  bucketId: string,
  data: {
    amount_cents: number;
    memo?: string;
    origin_type?: 'INCOME' | 'TRANSFER_FROM_BUCKET' | 'MANUAL';
    origin_id?: string;
    date?: string;
  }
): Promise<BucketMovement> {
  const response = await axios.post<{ data: BucketMovement }>(
    `${API_BASE}/${bucketId}/movements`,
    data
  );
  return response.data.data;
}

export async function deleteBucket(id: string): Promise<void> {
  await axios.delete(`${API_BASE}/${id}`);
}

