import React, { useState } from "react"
import Carousel from "react-material-ui-carousel"
import Card from "@material-ui/core/Card"
//import CardActions from "@material-ui/core/CardActions"
import CardContent from "@material-ui/core/CardContent"
// import Button from "@material-ui/core/Button"

function CarouselSlider() {
  fetch("https://api.github.com/users/BradNichol/repos?type=all&sort=updated")
    .then(response => response.json())
    .then(data => setItems(data))

  const [items, setItems] = useState([])

  return (
    <Carousel>
      {items.map(item => {
        return (
          <Card>
            <CardContent>
              <h4>{item.name}</h4>
              <hr />
              {item.description}
            </CardContent>
          </Card>
        )
      })}
    </Carousel>
  )
}

export default CarouselSlider
