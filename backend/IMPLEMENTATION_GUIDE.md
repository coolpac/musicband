# Backend Implementation Guide

This document outlines the implementation required for the backend Format repository and service to work with the updated Prisma schema.

## Updated Prisma Schema

The Format model has been updated with the following fields:

```prisma
model Format {
  id               String   @id @default(uuid())
  name             String   @unique
  shortDescription String?  @map("short_description")
  description      String?
  imageUrl         String?  @map("image_url")
  suitableFor      Json?    @map("suitable_for")
  performers       Json?
  status           String   @default("available")
  order            Int      @default(0)
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  bookings Booking[]

  @@map("formats")
}
```

## Migration

A migration file has been created at:
`backend/prisma/migrations/20260128150400_add_format_fields/migration.sql`

To apply the migration, run:
```bash
cd backend
npx prisma migrate deploy  # For production
# or
npx prisma migrate dev     # For development
```

## Required Implementation

### 1. Update PrismaFormatRepository

Location: `backend/src/infrastructure/repositories/PrismaFormatRepository.ts`

The repository should handle the new fields:

```typescript
import { Format, Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

export class PrismaFormatRepository {
  constructor(private prisma: PrismaClient) {}

  async findAll(): Promise<Format[]> {
    return this.prisma.format.findMany({
      orderBy: { order: 'asc' },
    });
  }

  async findById(id: string): Promise<Format | null> {
    return this.prisma.format.findUnique({
      where: { id },
    });
  }

  async findByStatus(status: string): Promise<Format[]> {
    return this.prisma.format.findMany({
      where: { status },
      orderBy: { order: 'asc' },
    });
  }

  async create(data: Prisma.FormatCreateInput): Promise<Format> {
    return this.prisma.format.create({ data });
  }

  async update(id: string, data: Prisma.FormatUpdateInput): Promise<Format> {
    return this.prisma.format.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Format> {
    return this.prisma.format.delete({
      where: { id },
    });
  }
}
```

### 2. Update FormatService

Location: `backend/src/domain/services/FormatService.ts`

The service should provide business logic for formats:

```typescript
import { Format } from '@prisma/client';
import { PrismaFormatRepository } from '../../infrastructure/repositories/PrismaFormatRepository';

export class FormatService {
  constructor(private formatRepository: PrismaFormatRepository) {}

  async getAllFormats(): Promise<Format[]> {
    return this.formatRepository.findAll();
  }

  async getFormatById(id: string): Promise<Format | null> {
    return this.formatRepository.findById(id);
  }

  async getAvailableFormats(): Promise<Format[]> {
    return this.formatRepository.findByStatus('available');
  }

  async createFormat(data: {
    name: string;
    shortDescription?: string;
    description?: string;
    imageUrl?: string;
    suitableFor?: string[];
    performers?: Array<{ name: string; role: string }>;
    status?: string;
    order?: number;
  }): Promise<Format> {
    return this.formatRepository.create({
      ...data,
      suitableFor: data.suitableFor as any,
      performers: data.performers as any,
    });
  }

  async updateFormat(
    id: string,
    data: {
      name?: string;
      shortDescription?: string;
      description?: string;
      imageUrl?: string;
      suitableFor?: string[];
      performers?: Array<{ name: string; role: string }>;
      status?: string;
      order?: number;
    }
  ): Promise<Format> {
    return this.formatRepository.update(id, {
      ...data,
      suitableFor: data.suitableFor as any,
      performers: data.performers as any,
    });
  }

  async deleteFormat(id: string): Promise<Format> {
    return this.formatRepository.delete(id);
  }
}
```

### 3. API Routes

Location: `backend/src/presentation/routes/formatRoutes.ts`

```typescript
import { Router } from 'express';
import { FormatService } from '../../domain/services/FormatService';

export function createFormatRoutes(formatService: FormatService): Router {
  const router = Router();

  // GET /api/formats - Get all formats
  router.get('/', async (req, res) => {
    try {
      const formats = await formatService.getAllFormats();
      res.json({ success: true, data: formats });
    } catch (error) {
      console.error('Error fetching formats:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // GET /api/formats/:id - Get format by ID
  router.get('/:id', async (req, res) => {
    try {
      const format = await formatService.getFormatById(req.params.id);
      if (!format) {
        return res.status(404).json({ success: false, message: 'Format not found' });
      }
      res.json({ success: true, data: format });
    } catch (error) {
      console.error('Error fetching format:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // POST /api/formats - Create new format (admin only)
  router.post('/', async (req, res) => {
    try {
      const format = await formatService.createFormat(req.body);
      res.status(201).json({ success: true, data: format });
    } catch (error) {
      console.error('Error creating format:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // PUT /api/formats/:id - Update format (admin only)
  router.put('/:id', async (req, res) => {
    try {
      const format = await formatService.updateFormat(req.params.id, req.body);
      res.json({ success: true, data: format });
    } catch (error) {
      console.error('Error updating format:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  // DELETE /api/formats/:id - Delete format (admin only)
  router.delete('/:id', async (req, res) => {
    try {
      await formatService.deleteFormat(req.params.id);
      res.json({ success: true, message: 'Format deleted' });
    } catch (error) {
      console.error('Error deleting format:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });

  return router;
}
```

### 4. Register Routes in Main App

In your `backend/src/index.ts` or main application file:

```typescript
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { PrismaFormatRepository } from './infrastructure/repositories/PrismaFormatRepository';
import { FormatService } from './domain/services/FormatService';
import { createFormatRoutes } from './presentation/routes/formatRoutes';

const app = express();
const prisma = new PrismaClient();

// ... other middleware

// Initialize services
const formatRepository = new PrismaFormatRepository(prisma);
const formatService = new FormatService(formatRepository);

// Register routes
app.use('/api/formats', createFormatRoutes(formatService));

// ... other routes and server startup
```

## Frontend Type Compatibility

The frontend expects the following TypeScript type:

```typescript
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
  status: 'available' | 'coming-soon';
  order: number;
};
```

This matches the Prisma schema, with the JSON fields properly typed in TypeScript.

## Testing

After implementation, test the API with:

```bash
# Get all formats
curl http://localhost:3000/api/formats

# Get specific format
curl http://localhost:3000/api/formats/main-show

# Create format (with admin authentication)
curl -X POST http://localhost:3000/api/formats \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Format",
    "shortDescription": "Test description",
    "status": "available",
    "order": 10
  }'
```

## Database Seeding

Consider creating a seed script to populate initial format data:

`backend/prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const formats = [
    {
      id: 'main-show',
      name: 'MAIN SHOW',
      shortDescription: 'Это мощное живое выступление созданное для ярких событий',
      description: 'Максимум энергии, харизма и музыка...',
      suitableFor: [
        'Корпоративы и премиальные вечеринки',
        'Свадьбы и частные торжества',
        'Городские праздники и фестивали',
      ],
      status: 'available',
      order: 1,
    },
    // ... other formats
  ];

  for (const format of formats) {
    await prisma.format.upsert({
      where: { id: format.id },
      update: format,
      create: format,
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Run with: `npx prisma db seed`
