-- Use a WITH clause for the image embeddings
WITH image_embeddings AS (
  SELECT *
  FROM
    ML.GENERATE_EMBEDDING(
      MODEL `patient_records.multimodal_embedding_model`,
      (SELECT * FROM `patient_records.encounters` WHERE content_type = 'image/jpeg')
    )
),
referral_embeddings AS (
    SELECT
        patient_name,
        dob,
        referring_facility,
        referring_provider,
        provisional_diagnosis,
        referral_date,
        referral_expiration_date,
        category_of_care,
        service_requested,
        content_embedding
    FROM
        `patient_records.referrals`
)
-- Create the vector search results table
SELECT 
  base.patient_name, base.dob, base.age, distance FROM VECTOR_SEARCH ( TABLE patient_records.referrals,
      'content_embedding',
      TABLE image_embeddings,
      top_k => 3 )
