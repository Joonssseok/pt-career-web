/**
 * @jest-environment jsdom
 *
 * Regression test for the scrollspy lazy-mount bug (PR #49 follow-up):
 * EditForm mounts its 6 <section id="..."> anchors only after an async
 * getOwnTermsAgreedAt()/getOwnProfile() round trip resolves. The sidebar's
 * useActiveSection() effect used to look up those elements exactly once,
 * synchronously, when it first ran -- if the sections weren't in the DOM
 * yet (the common case), IntersectionObserver.observe() was never called
 * on anything, and the highlight never worked for the rest of the page's
 * life.
 *
 * This test renders the sidebar component in isolation (no real EditForm),
 * confirms nothing is observed at mount, then appends the 6 section
 * elements to document.body -- exactly mimicking EditForm mounting them
 * later elsewhere in the same document -- and asserts the MutationObserver
 * catches this and registers all 6 with IntersectionObserver.
 */
import { render, act } from '@testing-library/react';
import { ProfileEditSectionLinksDesktop } from '@/components/ProfileEditSectionLinks';

jest.mock('next/navigation', () => ({
  usePathname: () => '/expert/edit',
}));

const SECTION_IDS = ['basic', 'experience', 'education', 'certification', 'workplace', 'gallery'];

class MockIntersectionObserver implements IntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: ReadonlyArray<number> = [];
  observedTargets: Element[] = [];
  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe(target: Element) {
    if (!this.observedTargets.includes(target)) {
      this.observedTargets.push(target);
    }
  }
  unobserve(target: Element) {
    this.observedTargets = this.observedTargets.filter((t) => t !== target);
  }
  disconnect() {
    this.observedTargets = [];
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

beforeEach(() => {
  MockIntersectionObserver.instances = [];
  (global as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;
});

afterEach(() => {
  SECTION_IDS.forEach((id) => document.getElementById(id)?.remove());
});

describe('ProfileEditSectionLinksDesktop scrollspy', () => {
  it('observes nothing at mount when EditForm has not rendered its sections yet', () => {
    render(<ProfileEditSectionLinksDesktop />);

    expect(MockIntersectionObserver.instances).toHaveLength(1);
    expect(MockIntersectionObserver.instances[0].observedTargets).toHaveLength(0);
  });

  it('catches sections that mount asynchronously after the sidebar (the actual EditForm timing)', async () => {
    render(<ProfileEditSectionLinksDesktop />);
    const observer = MockIntersectionObserver.instances[0];
    expect(observer.observedTargets).toHaveLength(0);

    // Simulate EditForm resolving getOwnTermsAgreedAt()/getOwnProfile() and
    // only then mounting the 6 <section id="..."> anchors elsewhere in the
    // document -- this is exactly what used to be missed.
    await act(async () => {
      SECTION_IDS.forEach((id) => {
        const el = document.createElement('section');
        el.id = id;
        document.body.appendChild(el);
      });
      // MutationObserver callbacks run as a microtask; flushing one macrotask
      // guarantees any pending microtasks (including it) have run first.
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const observedIds = observer.observedTargets.map((el) => el.id).sort();
    expect(observedIds).toEqual([...SECTION_IDS].sort());
  });

  it('stops the MutationObserver once all 6 sections are found (no unbounded observation)', async () => {
    const disconnectSpy = jest.spyOn(MutationObserver.prototype, 'disconnect');

    render(<ProfileEditSectionLinksDesktop />);

    await act(async () => {
      SECTION_IDS.forEach((id) => {
        const el = document.createElement('section');
        el.id = id;
        document.body.appendChild(el);
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(disconnectSpy).toHaveBeenCalled();
    disconnectSpy.mockRestore();
  });
});
