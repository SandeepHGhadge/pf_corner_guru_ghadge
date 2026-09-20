import { Media, Reveal, CountUp } from '../components/Ui.jsx';

export function Home({ content }) {
  const h = content.home;
  return (
    <>
      <section className="hero">
        <div className="w">
          <div>
            <h1 className="hl" style={{ '--d': '0s' }}>{h.title}</h1>
            <p className="lead hl" style={{ '--d': '.11s' }}>{h.sub}</p>
            <div className="stats hl" style={{ '--d': '.22s' }}>
              <div><CountUp value={h.n1} />{h.l1}</div>
              <div><CountUp value={h.n2} />{h.l2}</div>
            </div>
            <div className="hl" style={{ '--d': '.33s' }}>
              <a className="btn" href="#/contact">{h.cta1}</a>
              <a className="btn o" href="#/contact">{h.cta2}</a>
            </div>
          </div>
          <div className="ph hl" style={{ '--d': '.44s' }}>
            <Media value={h.heroImg} alt="PF consultancy" fallback="shield" />
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="w two">
          <Reveal kind="left">
            <p className="eyebrow">{h.welcomeKicker}</p>
            <h2>{h.welcomeTitle}</h2>
          </Reveal>
          <Reveal kind="right" delay={0.08}>
            <p>{h.welcome1}</p>
            <p>{h.welcome2}</p>
            <a className="btn" href="#/services">{h.welcomeCta}</a>
          </Reveal>
        </div>
      </section>

      <section className="sec" style={{ background: 'var(--soft)' }}>
        <div className="w">
          <Reveal as="h2" kind="up">{h.svcTitle}</Reveal>
          <br />
          {content.homeSvcs.map((s, i) => (
            <Reveal as="article" className="row" key={i} kind={i % 2 ? 'right' : 'left'} delay={0.05}>
              <div className="ph"><Media value={s.img || s.icon} alt={s.title} /></div>
              <div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
                <a href="#/contact">{content.ui.learn}</a>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="sec q">
        <div className="w">
          <Reveal as="p" kind="blur">&ldquo;{h.quote}&rdquo;</Reveal>
          <Reveal as="span" kind="blur" delay={0.1}>{h.quoteBy}</Reveal>
        </div>
      </section>
    </>
  );
}

export function Services({ content }) {
  const v = content.services;
  return (
    <>
      <section className="sec">
        <div className="w">
          <Reveal as="h1" kind="up">{v.title}</Reveal>
          <br />
          <div className="price">
            {v.items.map((s, i) => (
              <Reveal as="article" className="card" key={i} kind="zoom" delay={i * 0.1}>
                <div className="ph"><Media value={s.img || s.icon} alt={s.title} /></div>
                <h3>{s.title}</h3>
                <div className="amt">{s.price}</div>
                <p>{s.text}</p>
                <a className="btn" href="#/contact">{s.cta}</a>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="sec q">
        <div className="w">
          <Reveal as="h2" kind="blur">{v.qTitle}</Reveal>
          <Reveal as="p" kind="blur" delay={0.1} style={{ fontSize: '1.08rem', fontWeight: 500 }}>
            {v.qText}
          </Reveal>
          <Reveal kind="blur" delay={0.2}>
            <a className="btn" style={{ background: 'var(--on)', color: 'var(--brand)' }} href="#/contact">
              {v.qCta}
            </a>
          </Reveal>
        </div>
      </section>
    </>
  );
}

export function About({ content }) {
  const a = content.about;
  return (
    <section className="sec">
      <div className="w two">
        <Reveal kind="left">
          <h1>{a.title}</h1>
          <p className="lead">{a.sub}</p>
          <p>{a.text}</p>
        </Reveal>
        <Reveal className="ph" kind="right" delay={0.1} style={{ aspectRatio: 1 }}>
          <Media value={a.photo} alt="Gurudas Ghadge" fallback="user" />
        </Reveal>
      </div>
    </section>
  );
}
