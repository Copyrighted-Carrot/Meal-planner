import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import api from "../utils/api";
import { useLocation, useNavigate } from "react-router-dom"; // Import hooks
import { useCarrot } from "../context/CarrotContext";
import { useUserData } from '../context/UserDataContext';
import { captureSession, isCurrentSession } from '../utils/session';
import useDialogFocus from '../hooks/useDialogFocus';
import './UserDialogs.css';

import ParchmentContainer from "./Rustic/ParchmentContainer";
import InputPlank from "./Rustic/InputPlank";
import { LeafIcon } from "./Rustic/RusticIcons";
import IngredientManager from "./Rustic/IngredientManager";
import iconPen from "../assets/icon-pen.png";
import iconBasket from "../assets/icon-basket.svg";
import iconPhoto from "../assets/icon-photo.png";
import ImageCropper from "./Rustic/ImageCropper";

import ParchmentHeader from "./Rustic/ParchmentHeader";
import OccasionWheel from "./Rustic/OccasionWheel";
import rusticSaveBtn from "../assets/rustic-save-btn.png";
import './AddMeal.css';

// Icon Image Wrappers
const PenIcon = (props) => <img src={iconPen} alt="Pen" style={{ ...props.style, width: '100%', height: '100%', fill: undefined, objectFit: 'contain' }} />;
// IngredientsIcon removed as IngredientManager has its own icon
const PhotoIcon = (props) => <img src={iconPhoto} alt="Photo" style={{ ...props.style, width: '100%', height: '100%', fill: undefined, objectFit: 'contain' }} />;


function AddMeal({ setMeals, onOpenSmartFridge, draftMeal, setDraftMeal }) {
  const [meal, setMeal] = useState({
    name: draftMeal?.name || "",
    ingredients: draftMeal?.ingredients || "",
    category: draftMeal?.category || "",
    imageCrop: draftMeal?.imageCrop
  });
  const [image, setImage] = useState(draftMeal?.image || null);
  const [previewUrl, setPreviewUrl] = useState(draftMeal?.previewUrl || null);
  const [editId, setEditId] = useState(null); // ID of meal being edited
  const [editLoading, setEditLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formNotice, setFormNotice] = useState("");
  const saveInFlight = React.useRef(false);
  const occasionRef = React.useRef(null);
  const redirectTimer = React.useRef(null);
  const { assertSession, refreshMeals } = useUserData();
  const [imageRejected, setImageRejected] = useState(false); // Track if overly large image was rejected
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const previewDialogRef = useDialogFocus(showPreviewModal, () => setShowPreviewModal(false));
  const [showCropper, setShowCropper] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);

  const { say } = useCarrot();
  const sayRef = React.useRef(say);
  sayRef.current = say;
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => () => clearTimeout(redirectTimer.current), []);

  // Browser history carries only an ID; the API verifies ownership before reading.
  useEffect(() => {
    const mealId = location.state?.mealId || location.state?.mealToEdit?._id;
    if (!mealId) return;
    let active = true;
    const controller = new AbortController();
    setEditLoading(true);
    setFormError("");
    setFormNotice("");
    api.get(`/meals/${mealId}`, { signal: controller.signal }).then(({ data }) => {
      if (!active) return;
      assertSession();
      setMeal({ name: data.name, ingredients: Array.isArray(data.ingredients) ? data.ingredients.join(', ') : data.ingredients, category: data.category });
      setImage(null);
      setEditId(data._id);
      setPreviewUrl(data.imageUrl);
      setEditLoading(false);
      sayRef.current(`🥕 Editing ${data.name}? Let's make it better!`, 'carrot');
    }).catch(error => {
      if (active && error.code !== 'SESSION_CHANGED' && error.code !== 'REQUEST_CANCELLED' && error.statusCode !== 401) {
        navigate('/available-meals', { replace: true, state: null });
      }
    });
    return () => { active = false; controller.abort(); };
  }, [location.state, assertSession, navigate]);

  const handleRemoveImage = () => {
    setImage(null);
    setPreviewUrl(null);
    setShowPreviewModal(false);
    if (setDraftMeal) setDraftMeal(prev => ({ ...prev, image: null, previewUrl: null }));
  };

  const handleReplaceClick = () => {
    setShowPreviewModal(false);
    setTimeout(() => {
      if (fileInputRef.current) fileInputRef.current.click();
    }, 100);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // Increased limit for initial upload before crop
        say("🥕 Whoa! That image is massive. Try one under 5MB!", "carrot");
        return;
      }

      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageToCrop(reader.result);
        setShowCropper(true);
      });
      reader.readAsDataURL(file);

      // Clear input so same file can be selected again if cancelled
      e.target.value = null;

      // Store file immediately (will be cleared if cancelled)
      setImage(file);
    }
  };

  const handleCropComplete = (croppedBlob, croppedAreaPixels) => {
    // 1. Generate local preview from blob for user feedback
    const url = URL.createObjectURL(croppedBlob);
    setPreviewUrl(url);

    // 2. Keep the ORIGINAL file for upload
    // (We already have it in state if we want, or we can just rely on 'image' state not changing)
    // Actually, earlier logic wiped 'image' or set it to crop. 
    // We want 'image' to remain the ORIGINAL file.

    // We'll store the crop data in a new state
    console.log("🥕 SAVE CROP:", croppedAreaPixels);
    setMeal(prev => ({ ...prev, imageCrop: JSON.stringify(croppedAreaPixels) }));
    if (setDraftMeal) setDraftMeal(prev => ({ ...prev, image, imageCrop: JSON.stringify(croppedAreaPixels), previewUrl: url }));

    setShowCropper(false);
    setImageToCrop(null);
    say(`🥕 Crop saved! Dimensions: ${Math.round(croppedAreaPixels.width)}x${Math.round(croppedAreaPixels.height)}`, "carrot");
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setImageToCrop(null);
    setImage(null); // Clear selected file on cancel
  };

  // Handle Input Changes
  const validateMealData = () => {
    if (!meal.name.trim()) {
      setFormError("Please enter a meal name.");
      say("🥕 Every dish needs a name! What do you call this masterpiece?", "carrot");
      return false;
    }
    if (!meal.ingredients.trim()) {
      setFormError("Please add at least one ingredient.");
      say("🥕 What's in it? Don't keep the ingredients a secret!", "carrot");
      return false;
    }
    if (!meal.category) {
      setFormError("Please choose a meal occasion.");
      occasionRef.current?.querySelector('[role="button"], button')?.focus();
      say("🥕 When do we eat this? Choose Breakfast, Lunch, Dinner, or Snack on the occasion wheel!", "carrot");
      return false;
    }
    return true;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setMeal({ ...meal, [name]: value });
    if (setDraftMeal) setDraftMeal(prev => ({ ...prev, [name]: value }));
  };

  // Handle Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editLoading || saveInFlight.current) return;
    setFormError("");
    setFormNotice("");
    if (!validateMealData()) return;

    // Use FormData for file upload
    const formData = new FormData();
    formData.append("name", meal.name.trim());
    // Ingredients need to be sent as string or array depending on backend, 
    // but FormData sends strings. Logic in backend parses it.
    // We send comma-separated string here.
    formData.append("ingredients", meal.ingredients);
    formData.append("category", meal.category);
    if (meal.imageCrop) {
      console.log("🥕 Appending Crop Data:", meal.imageCrop);
      // Parse it back to object to send individual fields (safer than JSON string in FormData)
      try {
        const cropObj = typeof meal.imageCrop === 'string' ? JSON.parse(meal.imageCrop) : meal.imageCrop;
        formData.append("cropX", cropObj.x);
        formData.append("cropY", cropObj.y);
        formData.append("cropWidth", cropObj.width);
        formData.append("cropHeight", cropObj.height);
      } catch (e) {
        console.error("Failed to parse crop for sending", e);
      }
    } else {
      console.warn("🥕 No Crop Data found in state!");
    }

    if (image) {
      formData.append("image", image);
    }

    saveInFlight.current = true;
    setSaving(true);
    try {
      assertSession();
      const started = captureSession();
      let response;
      // Headers handled by api.js (Token) + Axios auto-detection (Multipart)

      if (editId) {
        // UPDATE Mode
        response = await api.put(`/meals/${editId}`, formData);
      } else {
        // CREATE Mode
        response = await api.post("/meals", formData);
      }

      // Check if response is successful
      if (response.data) {
        assertSession();
        setMeals(prevMeals => editId ? prevMeals.map(item => item._id === editId ? response.data : item) : [...prevMeals, response.data]);
        // Reconcile with the server even if the initial list was still loading.
        // A refresh failure is shown by the meal list; the save itself succeeded.
        await refreshMeals().catch(() => {});
        assertSession();

        // Clear form
        setMeal({ name: "", ingredients: "", category: "" });
        setImage(null);
        setPreviewUrl(null);
        if (setDraftMeal) setDraftMeal({ name: "", ingredients: "", category: "", image: null, previewUrl: null });
        setEditId(null);
        // Clear location state to prevent sticky edit mode
        navigate(location.pathname, { replace: true, state: null });

        // Show success message
        setFormNotice(editId ? "Meal updated successfully!" : "Meal added successfully!");
        if (imageRejected) {
          say("🥕 Meal added! (But the image was too big to upload 📸❌)", "carrot");
        } else {
          say(editId ? "🥕 Meal updated successfully!" : "🥕 Meal added successfully!", "carrot");
        }

        if (editId) {
          redirectTimer.current = setTimeout(() => {
            if (isCurrentSession(started)) navigate('/available-meals');
          }, 2000);
        }
      }
    } catch (error) {
      if (error.code === 'SESSION_CHANGED' || error.code === 'REQUEST_CANCELLED' || error.statusCode === 401) return;
      setFormError(error.message || "Could not save this meal. Please try again.");
      say(`🥕 Oops! ${error.message || "Something went wrong."}`, "carrot");
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  };


  // Handle Character Click (Toggle Menu only, don't force switch)


  const fileInputRef = React.useRef(null); // Ref for hidden file input

  return (
    <div className="add-meal-page">

      {/* MAIN LAYOUT: Single Wide Scroll with integrated Wheel */}
      <div className="add-meal-notebook">
        <form onSubmit={handleSubmit} aria-busy={saving || editLoading}
          aria-describedby={formError ? 'meal-form-error' : undefined}>
          <ParchmentContainer
            title="Craft Your Feast"
            sidePanel={
              <fieldset id="meal-occasion" className="recipe-occasion" ref={occasionRef} aria-describedby="meal-occasion-help">
                <legend>Meal occasion (required)</legend>
                <p id="meal-occasion-help" className="recipe-field-help">Choose Breakfast, Lunch, Dinner, or Snack before saving.</p>
                <OccasionWheel
                  selected={meal.category}
                  onSelect={(cat) => {
                    setMeal({ ...meal, category: cat });
                    if (setDraftMeal) setDraftMeal(prev => ({ ...prev, category: cat }));
                  }}
                />
              </fieldset>
            }
            footer={<>
              {formError && <div id="meal-form-error" role="alert" className="alert alert-danger">{formError}</div>}
              {saving && <p role="status" className="alert alert-info">Saving meal...</p>}
              {formNotice && <p role="status" className="alert alert-success">{formNotice}</p>}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                <button
                  type="button"
                  className="recipe-save-button"
                  disabled={saving || editLoading}
                  aria-label={saving ? 'Saving meal...' : editLoading ? 'Loading meal...' : editId ? 'Update Recipe' : 'Save Recipe'}
                  onClick={(event) => { event.preventDefault(); handleSubmit(event); }}
                  onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
                  onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <img src={rusticSaveBtn} alt="Save Recipe" />
                </button>
              </div>
            </>}
          >

            <div className="recipe-form-fields">

              {editLoading && <p role="status" className="alert alert-info">Loading meal for editing...</p>}

              <div>
                <label className="recipe-field-label" htmlFor="meal-name">Meal name (required)</label>
                <InputPlank
                  id="meal-name"
                  label="Meal name (required)"
                  name="name"
                  value={meal.name}
                  onChange={handleChange}
                  placeholder="Name Your Dish"
                  icon={PenIcon}
                />
              </div>

              {/* Ingredients Manager (Replaces Text Area) */}
              <IngredientManager
                ingredients={meal.ingredients}
                onChange={(val) => {
                  setMeal({ ...meal, ingredients: val });
                  if (setDraftMeal) setDraftMeal(prev => ({ ...prev, ingredients: val }));
                }}
              />

              {/* Photo Section Wrapper */}
              <div style={{ position: 'relative', width: '100%' }}>
                <p className="recipe-field-label">Photo (optional)</p>
                <p id="meal-photo-help" className="recipe-field-help">Choose an image up to 5 MB, then crop it to fit.</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept="image/*"
                  onChange={handleImageChange}
                />
                <InputPlank
                  label="Upload Photo"
                  describedBy="meal-photo-help"
                  value={image ? image.name : ""}
                  readOnly={true}
                  onClick={() => fileInputRef.current.click()}
                  icon={PhotoIcon}
                  placeholder={image ? "Photo Selected" : "Upload Photo"}
                />

                {/* The photo remains in document flow as the form grows. */}
                {previewUrl && (
                  <button
                    type="button"
                    className="recipe-photo-preview"
                    onClick={() => setShowPreviewModal(true)}
                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    title="Click to view/edit"
                  >
                    <img src={previewUrl} alt="Preview" style={{ height: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                  </button>
                )}
              </div>



            </div>
          </ParchmentContainer>
        </form>
      </div>

      {/* Image Preview Modal */}
      {showPreviewModal && ReactDOM.createPortal(
        <div ref={previewDialogRef} className="recipe-preview-overlay" role="dialog" aria-modal="true" aria-label="Recipe image preview" tabIndex={-1} style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          zIndex: 20000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backdropFilter: 'blur(5px)'
        }} onClick={() => setShowPreviewModal(false)}>

          <div className="recipe-preview-dialog" onClick={e => e.stopPropagation()}>
            {/* Enlarged Image */}
            <img
              src={previewUrl}
              alt="Full Size"
            />

            {/* Side Options */}
            <div className="recipe-preview-actions">
              <button
                type="button"
                onClick={handleReplaceClick}
                title="Replace Image"
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                🔄
              </button>
              <button
                type="button"
                className="recipe-preview-remove"
                onClick={handleRemoveImage}
                title="Delete Image"
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                🗑️
              </button>
              <button type="button" className="recipe-preview-close" onClick={() => setShowPreviewModal(false)} aria-label="Close image preview">✕</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showCropper && imageToCrop && (
        <ImageCropper
          imageSrc={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}

export default AddMeal;
