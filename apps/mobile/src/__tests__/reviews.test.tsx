import { render, screen, userEvent } from '@testing-library/react-native';

import { formatRating } from '@/lib/format';
import {
  reviewFromRow,
  summaryFromRow,
  type RatingSummary,
  type Review,
} from '@/features/reviews/api';
import { RatingSummaryLine, ReviewCard } from '@/features/reviews/components';
import { ReviewForm } from '@/features/reviews/review-form';
import { ReviewsSection } from '@/features/reviews/reviews-section';
import { StarRating } from '@/features/reviews/star-rating';
import '@/lib/i18n';

/** In-memory stand-in for the reviews API hooks: what the server returned and what was sent. */
class MockReviewsBackend {
  static reviews: Review[] = [];
  static summary: RatingSummary = { count: 0, average: null };
  static saved: { rating: number; comment: string }[] = [];
  static deleted = 0;

  static reset() {
    MockReviewsBackend.reviews = [];
    MockReviewsBackend.summary = { count: 0, average: null };
    MockReviewsBackend.saved = [];
    MockReviewsBackend.deleted = 0;
  }
}

jest.mock('@/features/reviews/api', () => {
  const actual = jest.requireActual('@/features/reviews/api');
  const idle = { isPending: false, error: null };
  return {
    ...actual,
    useAttractionReviews: () => ({ data: MockReviewsBackend.reviews, isPending: false }),
    useRatingSummary: () => ({ data: MockReviewsBackend.summary }),
    useSaveReview: () => ({
      ...idle,
      mutate: (form: { rating: number; comment: string }) => MockReviewsBackend.saved.push(form),
    }),
    useDeleteReview: () => ({ ...idle, mutate: () => MockReviewsBackend.deleted++ }),
  };
});

const review = (over: Partial<Review> = {}): Review => ({
  id: 'r1',
  rating: 4,
  comment: 'Great views from the top',
  createdAt: '2026-09-29T10:00:00Z',
  updatedAt: '2026-09-29T10:00:00Z',
  authorName: 'Carla',
  isOwn: false,
  ...over,
});

beforeEach(() => MockReviewsBackend.reset());

describe('mapping server rows', () => {
  test('a review row keeps rating, comment, dates, author and ownership', () => {
    const row = {
      id: 'r1',
      rating: 5,
      comment: null,
      created_at: '2026-09-29T10:00:00Z',
      updated_at: '2026-09-30T10:00:00Z',
      author_name: null,
      is_own: true,
    };
    expect(reviewFromRow(row)).toEqual({
      id: 'r1',
      rating: 5,
      comment: null,
      createdAt: '2026-09-29T10:00:00Z',
      updatedAt: '2026-09-30T10:00:00Z',
      authorName: null,
      isOwn: true,
    });
  });

  test('the summary is 0 reviews and no average when the attraction has none', () => {
    expect(summaryFromRow(null)).toEqual({ count: 0, average: null });
    expect(summaryFromRow({ review_count: 128, rating_avg: 4.56 })).toEqual({
      count: 128,
      average: 4.56,
    });
  });
});

describe('RatingSummaryLine', () => {
  test('shows the average with one decimal, a star and the number of reviews', () => {
    render(<RatingSummaryLine summary={{ count: 128, average: 4.56 }} />);
    expect(screen.getByTestId('rating-summary')).toHaveTextContent('4.6 ★ · 128 reviews');
  });

  test('uses the singular for one review and says when there are none', () => {
    render(<RatingSummaryLine summary={{ count: 1, average: 5 }} />);
    expect(screen.getByTestId('rating-summary')).toHaveTextContent('5.0 ★ · 1 review');
    screen.rerender(<RatingSummaryLine summary={{ count: 0, average: null }} />);
    expect(screen.getByTestId('rating-summary')).toHaveTextContent('No reviews yet');
  });

  test('formats the average in the app language', () => {
    expect(formatRating(4.56, 'pt')).toBe('4,6');
    expect(formatRating(4, 'en')).toBe('4.0');
  });
});

describe('StarRating', () => {
  test('pressing a star picks that rating', async () => {
    const onChange = jest.fn();
    render(<StarRating value={0} onChange={onChange} />);
    await userEvent.press(screen.getByLabelText('4 stars'));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  test('the chosen star is announced as selected', () => {
    render(<StarRating value={3} onChange={jest.fn()} />);
    expect(screen.getByLabelText('3 stars')).toBeChecked();
    expect(screen.getByLabelText('4 stars')).not.toBeChecked();
  });
});

describe('ReviewCard', () => {
  test('shows author, stars, comment and publication date', () => {
    render(<ReviewCard review={review()} />);
    const card = screen.getByTestId('review-r1');
    expect(card).toHaveTextContent(/Carla/);
    expect(card).toHaveTextContent(/Great views from the top/);
    expect(card).toHaveTextContent(/29 Sept 2026|Sep 29, 2026/);
    expect(screen.getByLabelText('Rated 4 out of 5')).toBeTruthy();
  });

  test('an author without a public name is shown as a traveller; own reviews say so', () => {
    render(<ReviewCard review={review({ authorName: null, isOwn: true })} />);
    expect(screen.getByTestId('review-r1')).toHaveTextContent(/Traveller/);
    expect(screen.getByTestId('review-r1')).toHaveTextContent(/Your review/);
  });

  test('says when a review was edited after publication', () => {
    render(<ReviewCard review={review({ updatedAt: '2026-10-02T10:00:00Z' })} />);
    expect(screen.getByTestId('review-r1')).toHaveTextContent(/edited/);
  });
});

describe('ReviewForm', () => {
  test('publishes a rating and a comment; the rating is required', async () => {
    const onSave = jest.fn();
    render(<ReviewForm initial={null} onSave={onSave} onDelete={jest.fn()} />);
    await userEvent.press(screen.getByTestId('save-review'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Choose from 1 to 5 stars')).toBeTruthy();

    await userEvent.press(screen.getByLabelText('5 stars'));
    await userEvent.type(screen.getByLabelText('Your comment (optional)'), 'Worth the climb');
    await userEvent.press(screen.getByTestId('save-review'));
    expect(onSave).toHaveBeenCalledWith({ rating: 5, comment: 'Worth the climb' });
  });

  test('a comment is optional', async () => {
    const onSave = jest.fn();
    render(<ReviewForm initial={null} onSave={onSave} onDelete={jest.fn()} />);
    await userEvent.press(screen.getByLabelText('2 stars'));
    await userEvent.press(screen.getByTestId('save-review'));
    expect(onSave).toHaveBeenCalledWith({ rating: 2, comment: '' });
  });

  test('an existing review is edited: fields are filled in and it can be deleted', async () => {
    const onSave = jest.fn();
    const onDelete = jest.fn();
    render(
      <ReviewForm initial={{ rating: 3, comment: 'Fine' }} onSave={onSave} onDelete={onDelete} />,
    );
    expect(screen.getByLabelText('3 stars')).toBeChecked();
    expect(screen.getByDisplayValue('Fine')).toBeTruthy();
    await userEvent.press(screen.getByLabelText('4 stars'));
    await userEvent.press(screen.getByText('Update review'));
    expect(onSave).toHaveBeenCalledWith({ rating: 4, comment: 'Fine' });

    await userEvent.press(screen.getByTestId('delete-review'));
    expect(onDelete).not.toHaveBeenCalled(); // asks first
    await userEvent.press(screen.getByText('Delete review'));
    expect(onDelete).toHaveBeenCalled();
  });

  test('a new review cannot be deleted', () => {
    render(<ReviewForm initial={null} onSave={jest.fn()} onDelete={jest.fn()} />);
    expect(screen.queryByTestId('delete-review')).toBeNull();
  });
});

describe('ReviewsSection', () => {
  test('lists every review of the attraction with the summary', () => {
    MockReviewsBackend.reviews = [review(), review({ id: 'r2', authorName: 'Dan', rating: 5 })];
    MockReviewsBackend.summary = { count: 2, average: 4.5 };
    render(<ReviewsSection attractionId="a1" />);
    expect(screen.getByTestId('review-r1')).toBeTruthy();
    expect(screen.getByTestId('review-r2')).toBeTruthy();
    expect(screen.getAllByTestId('rating-summary')[0]).toHaveTextContent('4.5 ★ · 2 reviews');
  });

  test('with no review of mine, the form publishes a new one', async () => {
    render(<ReviewsSection attractionId="a1" />);
    expect(screen.getByText('Publish review')).toBeTruthy();
    await userEvent.press(screen.getByLabelText('5 stars'));
    await userEvent.press(screen.getByTestId('save-review'));
    expect(MockReviewsBackend.saved).toEqual([{ rating: 5, comment: '' }]);
  });

  test('with a review of mine, the form edits it and offers to delete it', async () => {
    MockReviewsBackend.reviews = [review({ isOwn: true, rating: 2, comment: 'Crowded' })];
    render(<ReviewsSection attractionId="a1" />);
    expect(screen.getByDisplayValue('Crowded')).toBeTruthy();
    expect(screen.getByLabelText('2 stars')).toBeChecked();
    await userEvent.press(screen.getByTestId('delete-review'));
    await userEvent.press(screen.getByText('Delete review'));
    expect(MockReviewsBackend.deleted).toBe(1);
  });

  test("other people's reviews offer no edit or delete controls", () => {
    MockReviewsBackend.reviews = [review({ isOwn: false })];
    render(<ReviewsSection attractionId="a1" />);
    expect(screen.queryByTestId('delete-review')).toBeNull();
    expect(screen.getByText('Publish review')).toBeTruthy();
  });
});
