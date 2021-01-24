import React, { useState } from "react"
import { Link } from "gatsby"

function NavigationBar() {
  return (
    <>
      <nav className="flex justify-between text-xl font-semibold pb-10">
        <div>
          <Link to="/">BN</Link>
        </div>
        <ul className="flex flex-row">
          <li className="pr-5">
            <Link to="/">Home</Link>
          </li>
          <li className="pr-5">
            <Link to="/blog">Blog</Link>
          </li>
        </ul>
      </nav>
    </>
  )
}

export default NavigationBar
