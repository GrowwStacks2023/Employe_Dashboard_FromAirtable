import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number | null;
  maxStars?: number;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
}

const StarRating: React.FC<StarRatingProps> = ({ 
  rating, 
  maxStars = 5, 
  size = 'md',
  showValue = false 
}) => {
  console.log(`⭐ StarRating component received rating: ${rating} (type: ${typeof rating})`);
  
  if (rating === null || rating === undefined) {
    console.log(`⭐ StarRating showing "No Rating" for rating: ${rating} (type: ${typeof rating})`);
    return (
      <div className="flex items-center space-x-1">
        <span className="text-gray-400 text-xs">No Rating</span>
      </div>
    );
  }

  // Handle string numbers
  const numericRating = typeof rating === 'string' ? parseFloat(rating) : rating;
  
  if (isNaN(numericRating)) {
    console.log(`⭐ StarRating received invalid rating: ${rating}, showing "No Rating"`);
    return (
      <div className="flex items-center space-x-1">
        <span className="text-gray-400 text-xs">No Rating</span>
      </div>
    );
  }

  console.log(`⭐ StarRating rendering ${numericRating} stars (converted from ${rating})`);
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  const stars = [];
  
  for (let i = 1; i <= maxStars; i++) {
    const isFilled = i <= Math.floor(numericRating);
    const isPartial = i === Math.ceil(numericRating) && numericRating % 1 !== 0;
    const fillPercentage = isPartial ? (numericRating % 1) * 100 : 0;

    stars.push(
      <div key={i} className="relative">
        {isPartial ? (
          <div className="relative">
            {/* Background star (gray) */}
            <Star 
              className={`${sizeClasses[size]} text-gray-300`}
              fill="currentColor"
            />
            {/* Partial fill overlay */}
            <div 
              className="absolute top-0 left-0 overflow-hidden"
              style={{ width: `${fillPercentage}%` }}
            >
              <Star 
                className={`${sizeClasses[size]} text-yellow-400`}
                fill="currentColor"
              />
            </div>
          </div>
        ) : (
          <Star 
            className={`${sizeClasses[size]} ${
              isFilled ? 'text-yellow-400' : 'text-gray-300'
            }`}
            fill="currentColor"
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-1">
      <div className="flex items-center space-x-0.5">
        {stars}
      </div>
      {showValue && (
        <span className="text-sm font-medium text-yellow-600 ml-2">
          {numericRating.toFixed(1)}
        </span>
      )}
    </div>
  );
};

export default StarRating;