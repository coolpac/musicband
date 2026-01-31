/**
 * Dependency Injection Container
 * Централизованное управление зависимостями приложения
 */

import {
  PrismaUserRepository,
  PrismaBookingRepository,
  PrismaBlockedDateRepository,
  PrismaSongRepository,
  PrismaVoteRepository,
  PrismaFormatRepository,
  PrismaPosterRepository,
  PrismaPartnerRepository,
  PrismaAgentRepository,
  PrismaReviewRepository,
  PrismaReferralLinkRepository,
  PrismaReferralEventRepository,
} from '../infrastructure/database/repositories';

import { AuthService } from '../domain/services/AuthService';
import { BookingService } from '../domain/services/BookingService';
import { SongService } from '../domain/services/SongService';
import { VoteService } from '../domain/services/VoteService';
import { FormatService } from '../domain/services/FormatService';
import { PosterService } from '../domain/services/PosterService';
import { PartnerService } from '../domain/services/PartnerService';
import { AgentService } from '../domain/services/AgentService';
import { ReviewService } from '../domain/services/ReviewService';
import { ReferralService } from '../domain/services/ReferralService';

/**
 * DI Container класс
 */
class Container {
  // Repositories (singleton instances)
  private _userRepository?: PrismaUserRepository;
  private _bookingRepository?: PrismaBookingRepository;
  private _blockedDateRepository?: PrismaBlockedDateRepository;
  private _songRepository?: PrismaSongRepository;
  private _voteRepository?: PrismaVoteRepository;
  private _formatRepository?: PrismaFormatRepository;
  private _posterRepository?: PrismaPosterRepository;
  private _partnerRepository?: PrismaPartnerRepository;
  private _agentRepository?: PrismaAgentRepository;
  private _reviewRepository?: PrismaReviewRepository;
  private _referralLinkRepository?: PrismaReferralLinkRepository;
  private _referralEventRepository?: PrismaReferralEventRepository;

  // Services (singleton instances)
  private _authService?: AuthService;
  private _bookingService?: BookingService;
  private _songService?: SongService;
  private _voteService?: VoteService;
  private _formatService?: FormatService;
  private _posterService?: PosterService;
  private _partnerService?: PartnerService;
  private _agentService?: AgentService;
  private _reviewService?: ReviewService;
  private _referralService?: ReferralService;

  // === REPOSITORIES ===

  get userRepository(): PrismaUserRepository {
    if (!this._userRepository) {
      this._userRepository = new PrismaUserRepository();
    }
    return this._userRepository;
  }

  get bookingRepository(): PrismaBookingRepository {
    if (!this._bookingRepository) {
      this._bookingRepository = new PrismaBookingRepository();
    }
    return this._bookingRepository;
  }

  get blockedDateRepository(): PrismaBlockedDateRepository {
    if (!this._blockedDateRepository) {
      this._blockedDateRepository = new PrismaBlockedDateRepository();
    }
    return this._blockedDateRepository;
  }

  get songRepository(): PrismaSongRepository {
    if (!this._songRepository) {
      this._songRepository = new PrismaSongRepository();
    }
    return this._songRepository;
  }

  get voteRepository(): PrismaVoteRepository {
    if (!this._voteRepository) {
      this._voteRepository = new PrismaVoteRepository();
    }
    return this._voteRepository;
  }

  get formatRepository(): PrismaFormatRepository {
    if (!this._formatRepository) {
      this._formatRepository = new PrismaFormatRepository();
    }
    return this._formatRepository;
  }

  get posterRepository(): PrismaPosterRepository {
    if (!this._posterRepository) {
      this._posterRepository = new PrismaPosterRepository();
    }
    return this._posterRepository;
  }

  get partnerRepository(): PrismaPartnerRepository {
    if (!this._partnerRepository) {
      this._partnerRepository = new PrismaPartnerRepository();
    }
    return this._partnerRepository;
  }

  get agentRepository(): PrismaAgentRepository {
    if (!this._agentRepository) {
      this._agentRepository = new PrismaAgentRepository();
    }
    return this._agentRepository;
  }

  get reviewRepository(): PrismaReviewRepository {
    if (!this._reviewRepository) {
      this._reviewRepository = new PrismaReviewRepository();
    }
    return this._reviewRepository;
  }

  get referralLinkRepository(): PrismaReferralLinkRepository {
    if (!this._referralLinkRepository) {
      this._referralLinkRepository = new PrismaReferralLinkRepository();
    }
    return this._referralLinkRepository;
  }

  get referralEventRepository(): PrismaReferralEventRepository {
    if (!this._referralEventRepository) {
      this._referralEventRepository = new PrismaReferralEventRepository();
    }
    return this._referralEventRepository;
  }

  // === SERVICES ===

  get authService(): AuthService {
    if (!this._authService) {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET environment variable is required');
      }

      this._authService = new AuthService(
        this.userRepository,
        jwtSecret,
        process.env.JWT_EXPIRES_IN || '7d',
        process.env.TELEGRAM_ADMIN_BOT_TOKEN || '',
        process.env.TELEGRAM_USER_BOT_TOKEN,
        redis
      );
    }
    return this._authService;
  }

  get bookingService(): BookingService {
    if (!this._bookingService) {
      this._bookingService = new BookingService(
        this.bookingRepository,
        this.blockedDateRepository,
        this.userRepository,
        this.formatRepository
      );
    }
    return this._bookingService;
  }

  get songService(): SongService {
    if (!this._songService) {
      this._songService = new SongService(this.songRepository);
    }
    return this._songService;
  }

  get voteService(): VoteService {
    if (!this._voteService) {
      this._voteService = new VoteService(
        this.voteRepository,
        this.songRepository,
        this.userRepository
      );
    }
    return this._voteService;
  }

  get formatService(): FormatService {
    if (!this._formatService) {
      this._formatService = new FormatService(this.formatRepository);
    }
    return this._formatService;
  }

  get posterService(): PosterService {
    if (!this._posterService) {
      this._posterService = new PosterService(this.posterRepository);
    }
    return this._posterService;
  }

  get partnerService(): PartnerService {
    if (!this._partnerService) {
      this._partnerService = new PartnerService(this.partnerRepository);
    }
    return this._partnerService;
  }

  get agentService(): AgentService {
    if (!this._agentService) {
      this._agentService = new AgentService(
        this.agentRepository,
        this.userRepository,
        this.referralLinkRepository,
        this.referralEventRepository
      );
    }
    return this._agentService;
  }

  get reviewService(): ReviewService {
    if (!this._reviewService) {
      this._reviewService = new ReviewService(this.reviewRepository);
    }
    return this._reviewService;
  }

  get referralService(): ReferralService {
    if (!this._referralService) {
      this._referralService = new ReferralService(
        this.referralLinkRepository,
        this.referralEventRepository,
        this.agentRepository
      );
    }
    return this._referralService;
  }

  /**
   * Очистка ресурсов (для graceful shutdown)
   */
  async cleanup(): Promise<void> {
    // Здесь можно добавить логику закрытия соединений если нужно
    // Prisma автоматически управляет connection pool
  }
}

// Singleton instance
export const container = new Container();
