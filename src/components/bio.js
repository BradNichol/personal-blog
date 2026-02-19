/**
 * Bio component that queries for data
 * with Gatsby's StaticQuery component
 *
 * See: https://www.gatsbyjs.org/docs/static-query/
 */

import React from "react"
import { StaticQuery, graphql } from "gatsby"
import Image from "gatsby-image"
import styled from "styled-components"

import { rhythm } from "../utils/typography"

function Bio() {
  return (
    <StaticQuery
      query={bioQuery}
      render={data => {
        return (
          <div className="pt-12">
          <Container>
            <Image
              fixed={data.avatar.childImageSharp.fixed}
              alt={author}
              style={{
                marginRight: rhythm(1 / 2),
                marginBottom: 0,
                minWidth: 50,
                borderRadius: `100%`,
              }}
              imgStyle={{
                borderRadius: `50%`,
              }}
            />
            <div className="pt-5">
              <p>
                <strong>
                  Senior Backend Engineer. Pragmatic Builder. Clean Code Advocate.
                </strong>
              </p>
              <p>
                I'm a career changer turned senior Java developer in a FTSE 100
                environment. No formal CS background. Six years of building and
                shipping features inside large enterprise systems, working across
                backend services and data-focused engineering teams.
              </p>
              <p>
                I care deeply about clean architecture, readable code, and strong
                guard rails. Slop -- human or AI -- isn't acceptable. Discipline
                still matters.
              </p>
              <p>
                I'm not a coding savant and I don't aspire to be one. I enjoy
                building useful features that fit coherently into larger systems.
                Structure, clarity, and long-term maintainability are what
                interest me.
              </p>
              <p>
                Recently I've been exploring agentic development and modern AI
                tooling in real production contexts. Not chasing hype. Not
                replacing engineering judgment. Using AI as an amplifier -- not
                a shortcut.
              </p>
            </div>
          </Container>
          </div>
        )
      }}
    />
  )
}

const bioQuery = graphql`
  query BioQuery {
    avatar: file(absolutePath: { regex: "/profile-pic.jpg/" }) {
      childImageSharp {
        fixed(width: 50, height: 50) {
          ...GatsbyImageSharpFixed
        }
      }
    }
  }
`

const Container = styled.div`
  display: flex;
`

export default Bio
