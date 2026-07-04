
let iconContainer= new PIXI.ParticleContainer(70000)


function nbDistrictByHabitant(nh){
    //https://www.civilopedia.net/fr/rise-and-fall/concepts/cities_10/
    if (!nh){
        return 0
    }else if (nh<4){
        return 1
    }else if (nh<7){
        return 2
    }else{
        return 3+Math.floor((nh-7)/3)
    }
}

// Corompable / Defense