import React from "react";
import carrotIcon from "../assets/icons/carrot_icon.png";
import groceryIcon from "../assets/icons/grocery_icon.png";
import browseIcon from "../assets/icons/browse_icon.png";
import plannerIcon from "../assets/icons/planner_icon.png";
import logoutIcon from "../assets/icons/logout_icon.png";
import potIcon from "../assets/icons/pot_icon.png";

const iconStyle = {
    width: "32px",
    height: "32px",
    filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.4))",
    objectFit: "contain"
};

export const CarrotIcon = () => (
    <img src={carrotIcon} alt="Add Meal" style={iconStyle} />
);

export const PotIcon = () => (
    <img src={potIcon} alt="Available Meals" style={{ ...iconStyle, width: "26px", height: "26px" }} />
);

export const BookIcon = () => (
    <img src={browseIcon} alt="Browse Recipes" style={iconStyle} />
);

export const CalendarIcon = () => (
    <img src={plannerIcon} alt="Meal Planner" style={iconStyle} />
);

export const ListIcon = () => (
    <img src={groceryIcon} alt="Grocery List" style={iconStyle} />
);

export const LogoutIcon = () => (
    <img src={logoutIcon} alt="Logout" style={iconStyle} />
);
