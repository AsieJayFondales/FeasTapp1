document.addEventListener('DOMContentLoaded', function () {
    // Fetch saved recipes from the server and display them
    async function loadSavedRecipes() {
        try {
            // Fetch saved recipes data from the server
            const response = await fetch('/saved_recipes', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            // Check for successful response
            if (!response.ok) {
                console.error("Failed to fetch saved recipes:", response.status);
                const errorData = await response.json();
                document.querySelector('.container').innerHTML = `<p class="error-message">${errorData.error}</p>`;
                return;
            }

            // Parse the JSON response
            const data = await response.json();
            const recipes = data.recipes;

            // Get the recipe list container
            const recipeList = document.querySelector('.recipe-list');
            recipeList.innerHTML = ''; // Clear any existing recipes

            // Check if there are any saved recipes
            if (!recipes || recipes.length === 0) {
                recipeList.innerHTML = '<p>No recipes saved yet!</p>';
                return;
            }

            // Loop through each recipe and create list items
            recipes.forEach(recipe => {
                const listItem = document.createElement('li');
                listItem.classList.add('recipe-item');

                const recipeName = document.createElement('div');
                recipeName.classList.add('recipe-name');
                recipeName.textContent = recipe.name;

                const recipeDate = document.createElement('div');
                recipeDate.classList.add('recipe-date');
                recipeDate.textContent = `Saved on: ${recipe.saved_at}`;

                listItem.appendChild(recipeName);
                listItem.appendChild(recipeDate);
                recipeList.appendChild(listItem);
            });
        } catch (error) {
            console.error("Error loading saved recipes:", error);
            document.querySelector('.container').innerHTML = `<p class="error-message">An error occurred while loading recipes.</p>`;
        }
    }

    // Load saved recipes on page load
    loadSavedRecipes();
});
