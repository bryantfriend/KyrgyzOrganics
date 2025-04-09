document.addEventListener("DOMContentLoaded", () => {
  const jobsContainer = document.getElementById("jobs-container");
  const filter = document.getElementById("filter");

  const modal = document.getElementById("jobModal");
  const closeModal = document.querySelector(".close");
  const modalTitle = document.getElementById("modalTitle");
  const modalImage = document.getElementById("modalImage");
  const modalDescription = document.getElementById("modalDescription");
  const modalQualifications = document.getElementById("modalQualifications");
  const modalLocation = document.getElementById("modalLocation");

  let jobsData = [];

  fetch("jobs.json")
    .then(res => res.json())
    .then(data => {
      jobsData = data;
      renderJobs(jobsData);
    });

  filter.addEventListener("change", () => {
    const selected = filter.value;
    const filtered = selected === "All" ? jobsData : jobsData.filter(job => job.department === selected);
    renderJobs(filtered);
  });

  function renderJobs(jobs) {
    jobsContainer.innerHTML = "";
    jobs.forEach(job => {
      const jobCard = document.createElement("div");
      jobCard.className = "product";
      jobCard.innerHTML = `
        <img src="${job.image}" alt="${job.title}" />
        <h3>${job.title}</h3>
        <p>${job.shortDescription}</p>
        <button data-id="${job.id}">Learn More</button>
      `;
      jobCard.querySelector("button").addEventListener("click", () => showModal(job));
      jobsContainer.appendChild(jobCard);
    });
  }

  function showModal(job) {
    modalTitle.textContent = job.title;
    modalImage.src = job.image;
    modalImage.alt = job.title;
    modalDescription.textContent = job.fullDescription;
    modalQualifications.innerHTML = job.qualifications.map(q => `<li>${q}</li>`).join("");
    modalLocation.textContent = job.location;
    modal.style.display = "block";
  }

  closeModal.addEventListener("click", () => {
    modal.style.display = "none";
  });

  window.addEventListener("click", e => {
    if (e.target === modal) modal.style.display = "none";
  });
});
