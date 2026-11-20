"use client";

import Image from "next/image";
import type { TeamPageContent } from "@/content/home";
import { SiteHeader } from "./site-header";
import { Footer } from "./homepage-experience";
import { PageBlocks, pageBlocksFor } from "./page-blocks";
import { GlobalContactForm } from "./contact-form";
import { PageHero } from "./page-hero";
import { Reveal } from "./motion-reveal";

export function TeamPageExperience({ copy }: { copy: TeamPageContent }) {
  const ar = copy.locale === "ar";

  return (
    <>
      <SiteHeader copy={copy} page="team" />
      <main className="team-page" dir={copy.dir}>
        <PageBlocks
          blocks={pageBlocksFor(copy, "team")}
          builtins={{
            TEAM_HERO: (
              <PageHero
                locale={copy.locale}
                hero={copy.teamPage.hero}
                breadcrumbLabel={ar ? "فريق العمل" : "Our Team"}
                indexNumber="01"
                id="top"
                scrollTargetId="#team-roster"
              />
            ),
            TEAM_ROSTER: (
              <section
                id="team-roster"
                className="team-roster stage-pad"
                aria-label={copy.teamPage.eyebrow}
              >
                <div className="team-roster-head">
                  <span>02</span>
                  <p>
                    {ar
                      ? "الأشخاص الذين يصنعون رؤيتنا"
                      : "The people shaping our perspective"}
                  </p>
                  <strong>{String(copy.teamPage.members.length).padStart(2, "0")}</strong>
                </div>
                {copy.teamPage.members.length ? (
                  <div
                    className={`team-grid ${
                      copy.teamPage.members.length === 1 ? "team-grid--single" : ""
                    }`}
                  >
                    {copy.teamPage.members.map((member, index) => (
                      <Reveal
                        className={`team-card team-card--${index % 3}`}
                        delay={(index % 3) * 0.07}
                        key={member.id}
                      >
                        <div className="team-portrait">
                          <Image
                            src={member.image}
                            alt={member.alt}
                            fill
                            sizes="(max-width: 800px) 100vw, 50vw"
                          />
                        </div>
                        <div className="team-card-meta">
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          <div>
                            <h2>{member.name}</h2>
                            <p>{member.role}</p>
                          </div>
                        </div>
                        <p className="team-bio">{member.bio}</p>
                      </Reveal>
                    ))}
                  </div>
                ) : (
                  <p className="team-empty">
                    {ar
                      ? "سيتم الإعلان عن أعضاء الفريق قريباً."
                      : "Team profiles will be announced soon."}
                  </p>
                )}
              </section>
            ),
            CONTACT_FORM: <GlobalContactForm copy={copy} />,
          }}
        />
      </main>
      <Footer copy={copy} page="team" />
    </>
  );
}
