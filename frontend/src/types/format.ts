export type FormatStatus = 'available' | 'coming-soon';

export type Format = {
  id: string;
  name: string;
  shortDescription: string;
  description?: string;
  imageUrl?: string;
  suitableFor?: string[];
  performers?: Array<{
    name: string;
    role: string;
  }>;
  status: FormatStatus;
  order: number;
};
