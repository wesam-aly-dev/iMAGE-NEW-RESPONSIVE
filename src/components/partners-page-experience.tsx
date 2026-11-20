"use client";

import Image from "next/image";
import type { PartnersPageContent } from "@/content/home";
import { SiteHeader } from "./site-header";
import { Footer } from "./homepage-experience";
import { PageBlocks, pageBlocksFor } from "./page-blocks";
import { GlobalContactForm } from "./contact-form";
import { PageHero } from "./page-hero";
import { Reveal } from "./motion-reveal";

export function PartnersPageExperience({ copy }: { copy: PartnersPageContent }) {
  const ar = copy.locale === "ar";

  return (
    <>
      <SiteHeader copy={copy} page="partners" />
      <main className="partners-page" dir={copy.dir}>
        <PageBlocks
          blocks={pageBlocksFor(copy, "partners")}
          builtins={{
            PARTNERS_HERO: (
              <PageHero
                locale={copy.locale}
                hero={copy.partnersPage.hero}
                breadcrumbLabel={ar ? "شركاؤنا" : "Our Partners"}
                indexNumber="01"
                id="top"
                scrollTargetId="#partners-directory"
              />
            ),
            PARTNERS_DIRECTORY: (
              <section
                id="partners-directory"
                className="partners-directory stage-pad"
                aria-label={copy.partnersPage.eyebrow}
              >
                <div className="partners-directory-head">
                  <span>02</span>
                  <p>{ar ? "شركات نثق بها" : "Companies we trust"}</p>
                  <strong>{String(copy.partnersPage.partners.length).padStart(2, "0")}</strong>
                </div>
                {copy.partnersPage.partners.length ? (
                  <div
                    className={`partners-grid ${
                      copy.partnersPage.partners.length === 1 ? "partners-grid--single" : ""
                    }`}
                  >
                    {copy.partnersPage.partners.map((partner, index) => {
                      const content = (
                        <>
                          <div className="partner-logo">
                            <Image
                              src={partner.logo}
                              alt={partner.alt}
                              fill
                              sizes="(max-width: 800px) 70vw, 30vw"
                            />
                          </div>
                          <div className="partner-meta">
                            <span>{String(index + 1).padStart(2, "0")}</span>
                            <div>
                              <h2>{partner.name}</h2>
                              {partner.description && <p>{partner.description}</p>}
                            </div>
                            {partner.website && (
                              <b aria-hidden="true">{ar ? "←" : "→"}</b>
                            )}
                          </div>
                        </>
                      );
                      return (
                        <Reveal
                          className="partner-card"
                          delay={(index % 3) * 0.06}
                          key={partner.id}
                        >
                          {partner.website ? (
                            <a
                              href={partner.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`${partner.name} ${ar ? "←" : "→"}`}
                            >
                              {content}
                            </a>
                          ) : (
                            <div>{content}</div>
                          )}
                        </Reveal>
                      );
                    })}
                  </div>
                ) : (
                  <p className="partners-empty">
                    {ar
                      ? "سيتم الإعلان عن شركائنا قريباً."
                      : "Our partner network will be announced soon."}
                  </p>
                )}
              </section>
            ),
            CONTACT_FORM: <GlobalContactForm copy={copy} />,
          }}
        />
      </main>
      <Footer copy={copy} page="partners" />
    </>
  );
}
