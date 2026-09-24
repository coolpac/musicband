import { Hero } from '../sections/Hero/Hero';
import { Events } from '../sections/Events/Events';
import { WhyUs } from '../sections/WhyUs/WhyUs';
import { Formats } from '../sections/Formats/Formats';
import { Video } from '../sections/Video/Video';
import { Repertoire } from '../sections/Repertoire/Repertoire';
import { Rider } from '../sections/Rider/Rider';
import { Partners } from '../sections/Partners/Partners';
import { Social } from '../sections/Social/Social';
import { Cta } from '../sections/Cta/Cta';

/** Landing page. Each section decides on its own whether it has anything to show. */
export function HomePage() {
  return (
    <>
      <Hero />
      <Events />
      <WhyUs />
      <Formats />
      <Video />
      <Repertoire />
      <Rider />
      <Partners />
      <Social />
      <Cta />
    </>
  );
}
