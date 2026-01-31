/** available = показывать в бронировании, hidden = скрыт из выбора */
export type FormatStatus = 'available' | 'hidden' | 'coming-soon';

export type Format = {
  id: string;
  name: string;
  shortDescription?: string;
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
