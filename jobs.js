// jobs.js
const jobs = [
    {
        id: "delivery-driver",
        title: "Delivery Driver",
        image: "images/delivery_driver.jpg",
        shortDescription: "Deliver organic products to our customers around Bishkek.",
        fullPage: "jobs/delivery-driver.html"
    },
    {
        id: "bakery-assistant",
        title: "Bakery Assistant",
        image: "images/bakery_assistant.jpg",
        shortDescription: "Assist in baking our signature sourdough bread.",
        fullPage: "jobs/bakery-assistant.html"
    }
];

const jobsContainer = document.getElementById("jobs-container");

jobs.forEach(job => {
    const jobCard = document.createElement("div");
    jobCard.className = "product"; // reuse product styling

    jobCard.innerHTML = `
        <img src="${job.image}" alt="${job.title}">
        <h3>${job.title}</h3>
        <p>${job.shortDescription}</p>
        <a href="${job.fullPage}">Learn More</a>
    `;

    jobsContainer.appendChild(jobCard);
});
